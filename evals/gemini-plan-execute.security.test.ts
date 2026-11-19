/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as planVerifierModule from '../scripts/resolve-approved-plan.mjs';
import {
  computePlanSha256,
  DEFAULT_BOT_LOGIN,
  DISALLOWED_PLAN_EXECUTE_MCP_TOOLS,
  ensureGeminiIgnoreAllowsContextFiles,
  extractApprovalContext,
  fetchIssueCommentById,
  parseApprovalDirective,
  PlanVerificationError,
  prepareContextAndGeminiIgnore,
  resolveTrustedPlanAuthors,
  sanitizePlanExecuteSettingsFile,
  selectVerifiedPlan,
  verifyAndWriteApprovedPlan,
} from '../scripts/resolve-approved-plan.mjs';

interface McpServerSettings {
  includeTools?: string[];
  excludeTools?: string[];
}

interface WorkflowGeminiSettings {
  mcpServers?: Record<string, McpServerSettings>;
  tools?: {
    core?: string[];
  };
}

const REPO_ROOT = resolve(__dirname, '..');

const AMBIENT_GITHUB_ENV_KEYS = [
  'GITHUB_REPOSITORY',
  'GITHUB_EVENT_NAME',
  'GITHUB_EVENT_PATH',
  'GITHUB_API_URL',
  'GITHUB_TOKEN',
  'EXPECTED_PLAN_AUTHOR',
  'WORKFLOW_NAME',
  'PROMPT_INPUT',
] as const;

const PLAN_EXECUTE_WORKFLOWS = [
  '.github/workflows/gemini-plan-execute.yml',
  'examples/workflows/gemini-assistant/gemini-plan-execute.yml',
] as const;

const PLAN_EXECUTE_TOMLS = [
  '.github/commands/gemini-plan-execute.toml',
  'examples/workflows/gemini-assistant/gemini-plan-execute.toml',
] as const;

const INVOKE_TOMLS = [
  '.github/commands/gemini-invoke.toml',
  'examples/workflows/gemini-assistant/gemini-invoke.toml',
] as const;

const REQUIRED_PR_FLOW_MCP_TOOLS = [
  'add_issue_comment',
  'create_branch',
  'create_or_update_file',
  'create_pull_request',
] as const;

const SAMPLE_BOT_PLAN_A = [
  '## 🤖 AI Assistant: Plan of Action',
  '',
  '- [ ] Step 1: Add unit test in tests/example.test.ts',
].join('\n');

const SAMPLE_BOT_PLAN_B = [
  '## 🤖 AI Assistant: Plan of Action',
  '',
  '- [ ] Step 1: Update README.md quick-start section',
].join('\n');

beforeEach(() => {
  for (const key of AMBIENT_GITHUB_ENV_KEYS) {
    vi.stubEnv(key, '');
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8');
}

function extractEmbeddedSettingsJson(
  workflowYaml: string,
): WorkflowGeminiSettings {
  const lines = workflowYaml.split(/\r?\n/);
  const settingsLineIndex = lines.findIndex((line) =>
    /^\s*settings:\s*\|-\s*$/.test(line),
  );
  if (settingsLineIndex === -1) {
    throw new Error('Could not locate literal block scalar `settings: |-`');
  }

  const keyIndent = lines[settingsLineIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const blockLines: string[] = [];

  for (let i = settingsLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      blockLines.push('');
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }
    blockLines.push(line);
  }

  const minBlockIndent = Math.min(
    ...blockLines
      .filter((line) => line.trim().length > 0)
      .map((line) => line.match(/^(\s*)/)?.[1].length ?? 0),
  );

  const rawJson = blockLines
    .map((line) =>
      line.length >= minBlockIndent ? line.slice(minBlockIndent) : line,
    )
    .join('\n');

  return JSON.parse(rawJson) as WorkflowGeminiSettings;
}

function createIssueCommentEvent(overrides?: {
  action?: string;
  commentId?: number;
  commentBody?: string;
  createdAt?: string;
  authorAssociation?: string;
  senderType?: string;
  issueNumber?: number;
  isPullRequestIssueComment?: boolean;
}) {
  return {
    action: overrides?.action ?? 'created',
    repository: { full_name: 'acme/demo-repo' },
    sender: {
      login: 'maintainer-alice',
      type: overrides?.senderType ?? 'User',
    },
    issue: {
      number: overrides?.issueNumber ?? 42,
      title: 'Improve documentation',
      body: 'Please clarify setup steps.',
      ...(overrides?.isPullRequestIssueComment
        ? {
            pull_request: {
              url: 'https://api.github.com/repos/acme/demo-repo/pulls/42',
            },
          }
        : {}),
    },
    comment: {
      id: overrides?.commentId ?? 200,
      body: overrides?.commentBody ?? '@gemini-cli /approve 100',
      created_at: overrides?.createdAt ?? '2026-11-17T18:10:00Z',
      updated_at: overrides?.createdAt ?? '2026-11-17T18:10:00Z',
      author_association: overrides?.authorAssociation ?? 'OWNER',
      user: {
        login: 'maintainer-alice',
        type: overrides?.senderType ?? 'User',
      },
    },
  };
}

describe('gemini-plan-execute static security invariants', () => {
  it.each(PLAN_EXECUTE_WORKFLOWS)(
    'restricts github MCP includeTools and excludes mutable issue DESCRIPTION in %s',
    (workflowPath) => {
      const yaml = readRepoFile(workflowPath);
      const settings = extractEmbeddedSettingsJson(yaml);
      const includeTools = settings.mcpServers?.['github']?.includeTools ?? [];

      expect(includeTools).toEqual(
        expect.arrayContaining([...REQUIRED_PR_FLOW_MCP_TOOLS]),
      );

      const grantedDisallowedTools = DISALLOWED_PLAN_EXECUTE_MCP_TOOLS.filter(
        (tool) => includeTools.includes(tool),
      );
      expect(grantedDisallowedTools).toEqual([]);

      expect(yaml).not.toContain('DESCRIPTION:');
      expect(yaml).not.toContain('TITLE:');
      expect(yaml).toContain('EXPECTED_PLAN_AUTHOR');
      expect(yaml).toContain(
        "ref: '${{ github.event.repository.default_branch }}'",
      );
    },
  );

  it.each(PLAN_EXECUTE_TOMLS)(
    'binds execution to .gemini/approved_plan.json instead of unbound latest-comment search in %s',
    (tomlPath) => {
      const toml = readRepoFile(tomlPath);

      expect(toml).not.toMatch(
        /find a latest plan titled with "AI Assistant: Plan of Action"/i,
      );
      expect(toml).toContain('@{.gemini/approved_plan.json}');
      expect(toml).toContain('@{.gemini/context.json}');
    },
  );

  it('keeps shipped and example plan-execute workflows and TOML templates synchronized', () => {
    expect(readRepoFile('.github/commands/gemini-plan-execute.toml')).toBe(
      readRepoFile(
        'examples/workflows/gemini-assistant/gemini-plan-execute.toml',
      ),
    );
    expect(readRepoFile('.github/commands/gemini-invoke.toml')).toBe(
      readRepoFile('examples/workflows/gemini-assistant/gemini-invoke.toml'),
    );
    expect(
      readRepoFile('.github/workflows/gemini-plan-execute.yml').replace(
        "uses: './'",
        "uses: 'google-github-actions/run-gemini-cli@v0' # ratchet:exclude",
      ),
    ).toBe(
      readRepoFile(
        'examples/workflows/gemini-assistant/gemini-plan-execute.yml',
      ),
    );

    for (const tomlPath of [...PLAN_EXECUTE_TOMLS, ...INVOKE_TOMLS]) {
      expect(readRepoFile(tomlPath)).not.toMatch(
        /!\{echo\s+\$(TITLE|DESCRIPTION|ADDITIONAL_CONTEXT)\}/,
      );
    }

    for (const invokePath of INVOKE_TOMLS) {
      expect(readRepoFile(invokePath)).toContain(
        '@gemini-cli /approve <comment-url-or-id>',
      );
    }

    expect(readRepoFile('scripts/generate-examples.sh')).toContain(
      "s|uses: './'|uses: 'google-github-actions/run-gemini-cli@v0' # ratchet:exclude|g",
    );
  });

  it('gates plan execution fail-closed in action.yml and keeps .d.mts exports in 1:1 parity', () => {
    const actionYaml = readRepoFile('action.yml');
    expect(actionYaml).toContain("name: 'Verify approved plan'");
    expect(actionYaml).toContain('rm -f .gemini/approved_plan.json');
    expect(actionYaml).toContain(
      'node "${GITHUB_ACTION_PATH}/scripts/resolve-approved-plan.mjs" --verify',
    );
    expect(actionYaml).toContain('if [[ ! -s ".gemini/approved_plan.json" ]]');

    const dts = readRepoFile('scripts/resolve-approved-plan.d.mts');
    const declaredValueExports = Array.from(
      dts.matchAll(/^export\s+(?:const|class|function)\s+([A-Za-z0-9_]+)/gm),
      (match) => match[1],
    ).sort();
    expect(Object.keys(planVerifierModule).sort()).toEqual(
      declaredValueExports,
    );
  });
});

describe('parseApprovalDirective & computePlanSha256', () => {
  it('normalizes CRLF line endings identically to LF in computePlanSha256', () => {
    const lf = '## 🤖 AI Assistant: Plan of Action\n\n- [ ] Step 1\n';
    const crlf = '## 🤖 AI Assistant: Plan of Action\r\n\r\n- [ ] Step 1\r\n';
    expect(computePlanSha256(crlf)).toBe(computePlanSha256(lf));
  });

  it('parses bare /approve, numeric IDs, fragments, PR/Issue URLs, and notification query URLs', () => {
    expect(parseApprovalDirective('@gemini-cli /approve')).toEqual({
      targetCommentId: null,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: '',
    });

    expect(
      parseApprovalDirective(
        '@gemini-cli /approve 123456 looks good for step 1',
      ),
    ).toEqual({
      targetCommentId: 123456,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: 'looks good for step 1',
    });

    expect(
      parseApprovalDirective('@gemini-cli /approve #issuecomment-789012'),
    ).toEqual({
      targetCommentId: 789012,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: '',
    });

    expect(
      parseApprovalDirective(
        '@gemini-cli /approve https://github.com/acme/demo-repo/pull/42?notification_referrer_id=NT_kw#issuecomment-345678 proceed',
      ),
    ).toEqual({
      targetCommentId: 345678,
      urlRepository: 'acme/demo-repo',
      urlIssueNumber: 42,
      additionalContext: 'proceed',
    });
  });

  it('rejects duplicate IDs, unsafe integers, malformed URLs, trailing comment refs after prose, and non-approval prefixes', () => {
    expect(() =>
      parseApprovalDirective('@gemini-cli /approve 100 200'),
    ).toThrow(/Duplicate plan comment ID/);
    expect(() =>
      parseApprovalDirective('@gemini-cli /approve 999999999999999999999'),
    ).toThrow(PlanVerificationError);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve https://example.com/bad-url',
      ),
    ).toThrow(/Invalid GitHub issue\/PR comment URL/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve acme/demo-repo#issuecomment-100',
      ),
    ).toThrow(/Invalid GitHub issue\/PR comment URL/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve should NOT be run on #issuecomment-100',
      ),
    ).toThrow(/must appear immediately after/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve 100 ignore https://github.com/acme/demo-repo/issues/42#issuecomment-200',
      ),
    ).toThrow(/must appear immediately after/);

    expect(parseApprovalDirective('@gemini-cli /review')).toBeNull();
    expect(parseApprovalDirective('@gemini-cli /approved')).toBeNull();
    expect(
      parseApprovalDirective('Please run @gemini-cli /approve 100'),
    ).toBeNull();
    expect(parseApprovalDirective(null)).toBeNull();
  });
});

describe('extractApprovalContext', () => {
  it('supports issue_comment (Issue & PR), pull_request_review, and pull_request_review_comment events', () => {
    const prIssueComment = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 500,
        isPullRequestIssueComment: true,
      }),
    );
    expect(prIssueComment.issueNumber).toBe(42);
    expect(prIssueComment.isPullRequest).toBe(true);
    expect(prIssueComment.sharesIssueCommentIdSpace).toBe(true);

    const reviewCtx = extractApprovalContext('pull_request_review', {
      action: 'submitted',
      repository: { full_name: 'acme/demo-repo' },
      sender: { login: 'maintainer-alice', type: 'User' },
      pull_request: { number: 19 },
      review: {
        id: 12,
        body: '@gemini-cli /approve 100',
        submitted_at: '2026-11-17T18:10:00Z',
        author_association: 'MEMBER',
        user: { login: 'maintainer-alice', type: 'User' },
      },
    });
    expect(reviewCtx.isPullRequest).toBe(true);
    expect(reviewCtx.sharesIssueCommentIdSpace).toBe(false);

    const diffCommentCtx = extractApprovalContext(
      'pull_request_review_comment',
      {
        action: 'created',
        repository: { full_name: 'acme/demo-repo' },
        sender: { login: 'maintainer-alice', type: 'User' },
        pull_request: { number: 19 },
        comment: {
          id: 15,
          body: '@gemini-cli /approve 100',
          created_at: '2026-11-17T18:10:00Z',
          author_association: 'COLLABORATOR',
          user: { login: 'maintainer-alice', type: 'User' },
        },
      },
    );
    expect(diffCommentCtx.isPullRequest).toBe(true);
    expect(diffCommentCtx.sharesIssueCommentIdSpace).toBe(false);
  });

  it.each(['NONE', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER'])(
    'rejects unauthorized approver association %s',
    (association) => {
      const event = createIssueCommentEvent({ authorAssociation: association });
      expect(() => extractApprovalContext('issue_comment', event)).toThrow(
        PlanVerificationError,
      );
    },
  );

  it('rejects edited/deleted/dismissed actions, non-User senders, and invalid approval IDs', () => {
    expect(() =>
      extractApprovalContext(
        'issue_comment',
        createIssueCommentEvent({ action: 'edited' }),
      ),
    ).toThrow(/expected "created"/);

    expect(() =>
      extractApprovalContext('pull_request_review', {
        action: 'dismissed',
        pull_request: { number: 19 },
        review: {
          id: 12,
          body: '@gemini-cli /approve 100',
          submitted_at: '2026-11-17T18:10:00Z',
          author_association: 'OWNER',
          user: { login: 'maintainer-alice', type: 'User' },
        },
      }),
    ).toThrow(/expected "submitted"/);

    expect(() =>
      extractApprovalContext(
        'issue_comment',
        createIssueCommentEvent({ senderType: 'Bot' }),
      ),
    ).toThrow(PlanVerificationError);

    expect(() =>
      extractApprovalContext(
        'issue_comment',
        createIssueCommentEvent({ commentId: 0 }),
      ),
    ).toThrow(/Missing or invalid approval event ID/);
  });
});

describe('selectVerifiedPlan (TOCTOU, provenance, URL spoofing & immutability)', () => {
  const defaultTrusted = resolveTrustedPlanAuthors('');

  it('rejects bare @gemini-cli /approve without a comment ID/URL binding', () => {
    const bareApproval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({ commentBody: '@gemini-cli /approve' }),
    );
    const comment = {
      id: 100,
      issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
      body: SAMPLE_BOT_PLAN_A,
      created_at: '2026-11-17T18:00:00Z',
      updated_at: '2026-11-17T18:00:00Z',
      user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
    };

    expect(() =>
      selectVerifiedPlan(comment, bareApproval, defaultTrusted),
    ).toThrow(/must bind to a specific plan comment ID or URL/i);
  });

  it('prevents [T_read, T_approve] TOCTOU comment substitution and same-second post-approval races', () => {
    const approval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 200,
        commentBody: '@gemini-cli /approve #issuecomment-100',
        createdAt: '2026-11-17T18:10:00Z',
      }),
    );

    const comments = [
      {
        id: 100,
        issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
        body: SAMPLE_BOT_PLAN_A,
        created_at: '2026-11-17T18:00:00Z',
        updated_at: '2026-11-17T18:00:00Z',
        user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
      },
      {
        id: 150,
        issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
        body: SAMPLE_BOT_PLAN_B,
        created_at: '2026-11-17T18:08:00Z',
        updated_at: '2026-11-17T18:08:00Z',
        user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
      },
    ];

    const selected = selectVerifiedPlan(comments, approval, defaultTrusted);
    expect(selected.comment_id).toBe(100);
    expect(selected.plan).toBe(SAMPLE_BOT_PLAN_A);

    const sameSecondRaceApproval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 200,
        commentBody: '@gemini-cli /approve 201',
        createdAt: '2026-11-17T18:10:00Z',
      }),
    );
    const sameSecondComment = {
      id: 201,
      issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
      body: SAMPLE_BOT_PLAN_B,
      created_at: '2026-11-17T18:10:00Z',
      updated_at: '2026-11-17T18:10:00Z',
      user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
    };
    expect(() =>
      selectVerifiedPlan(
        sameSecondComment,
        sameSecondRaceApproval,
        defaultTrusted,
      ),
    ).toThrow(/created after approval comment #200/);
  });

  it('rejects cross-repo/cross-issue URLs, mismatched issue_url, invalid slugs, and non-heading comments', () => {
    const validComment = {
      id: 100,
      body: SAMPLE_BOT_PLAN_A,
      created_at: '2026-11-17T18:00:00Z',
      updated_at: '2026-11-17T18:00:00Z',
      issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
      user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
    };

    const crossRepoApproval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentBody:
          '@gemini-cli /approve https://github.com/other/repo/issues/42#issuecomment-100',
      }),
    );
    expect(() =>
      selectVerifiedPlan(validComment, crossRepoApproval, defaultTrusted),
    ).toThrow(/does not match current repository/);

    const crossIssueUrlApproval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentBody:
          '@gemini-cli /approve https://github.com/acme/demo-repo/issues/99#issuecomment-100',
      }),
    );
    expect(() =>
      selectVerifiedPlan(validComment, crossIssueUrlApproval, defaultTrusted),
    ).toThrow(/does not match current issue/);

    const standardApproval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({ commentBody: '@gemini-cli /approve 100' }),
    );
    expect(() =>
      selectVerifiedPlan(
        {
          ...validComment,
          issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/999',
        },
        standardApproval,
        defaultTrusted,
      ),
    ).toThrow(/belongs to a different issue/);

    expect(() =>
      selectVerifiedPlan(
        { ...validComment, issue_url: 'not-a-valid-url' },
        standardApproval,
        defaultTrusted,
      ),
    ).toThrow(/malformed issue_url/);

    expect(() =>
      selectVerifiedPlan(
        {
          ...validComment,
          body: 'Mentioning AI Assistant: Plan of Action in prose without a heading.',
        },
        standardApproval,
        defaultTrusted,
      ),
    ).toThrow(/does not contain a Markdown heading/);

    expect(() =>
      selectVerifiedPlan(
        validComment,
        { ...standardApproval, repository: '' },
        defaultTrusted,
      ),
    ).toThrow(/Unable to determine valid target GitHub repository/);

    expect(() =>
      selectVerifiedPlan(validComment, standardApproval, defaultTrusted, {
        targetRepository: '../victim',
      }),
    ).toThrow(/Unable to determine valid target GitHub repository/);
  });

  it('enforces bot authorship, blocks ghu_ user spoofing, and rejects all edited or post-approval comments', () => {
    const approval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 200,
        commentBody: '@gemini-cli /approve 150',
      }),
    );

    const ghuUserSpoofComment = {
      id: 150,
      issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
      body: SAMPLE_BOT_PLAN_B,
      created_at: '2026-11-17T18:05:00Z',
      updated_at: '2026-11-17T18:05:00Z',
      performed_via_github_app: { id: 9876, slug: 'acme-custom-app' },
      user: { login: 'external-commenter', type: 'User' },
    };
    expect(() =>
      selectVerifiedPlan(ghuUserSpoofComment, approval, defaultTrusted, {
        allowInstalledGithubAppBots: true,
      }),
    ).toThrow(/not an authorized plan bot/);

    const installedAppBotComment = {
      id: 150,
      issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
      body: SAMPLE_BOT_PLAN_A,
      created_at: '2026-11-17T18:05:00Z',
      updated_at: '2026-11-17T18:05:00Z',
      performed_via_github_app: { id: 9876, slug: 'acme-custom-app' },
      user: { login: 'acme-custom-app[bot]', type: 'Bot' },
    };
    expect(
      selectVerifiedPlan(installedAppBotComment, approval, defaultTrusted, {
        allowInstalledGithubAppBots: true,
      }).author_login,
    ).toBe('acme-custom-app[bot]');

    const mixedCaseTrusted = resolveTrustedPlanAuthors('Acme-Custom-App[BOT]');
    expect(
      selectVerifiedPlan(installedAppBotComment, approval, mixedCaseTrusted)
        .author_login,
    ).toBe('acme-custom-app[bot]');

    const editedBeforeApproval = {
      ...installedAppBotComment,
      updated_at: '2026-11-17T18:06:00Z',
    };
    expect(() =>
      selectVerifiedPlan(editedBeforeApproval, approval, mixedCaseTrusted),
    ).toThrow(/edited after creation/i);

    const editedAfterApproval = {
      ...installedAppBotComment,
      updated_at: '2026-11-17T18:10:05Z',
    };
    expect(() =>
      selectVerifiedPlan(editedAfterApproval, approval, mixedCaseTrusted),
    ).toThrow(/created or modified after approval/i);
  });
});

describe('End-to-end verification (HTTP API, symlinked runner, settings pruning & ambient CI env isolation)', () => {
  let tempWorkspace = '';
  let symlinkRoot = '';
  let httpServer: Server | null = null;

  beforeEach(() => {
    tempWorkspace = mkdtempSync(join(tmpdir(), 'plan-verify-e2e-'));
    symlinkRoot = mkdtempSync(join(tmpdir(), 'plan-verify-symlink-'));
  });

  afterEach(async () => {
    if (httpServer) {
      await new Promise<void>((resolveClose) =>
        httpServer!.close(() => resolveClose()),
      );
      httpServer = null;
    }
    for (const dir of [tempWorkspace, symlinkRoot]) {
      if (dir && existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('verifies approved plan via symlinked script path, strips mutable context, prunes settings.json, and updates .geminiignore', async () => {
    const symlinkedRepo = join(symlinkRoot, 'action-link');
    symlinkSync(REPO_ROOT, symlinkedRepo);
    const symlinkedScript = join(
      symlinkedRepo,
      'scripts/resolve-approved-plan.mjs',
    );

    mkdirSync(join(tempWorkspace, '.gemini'), { recursive: true });
    writeFileSync(join(tempWorkspace, '.gitignore'), '.gemini/\n');
    writeFileSync(join(tempWorkspace, '.geminiignore'), '*.json\n');

    writeFileSync(
      join(tempWorkspace, '.gemini/settings.json'),
      JSON.stringify({
        mcpServers: {
          github: {
            includeTools: [
              'add_issue_comment',
              'issue_read',
              'create_branch',
              'create_or_update_file',
              'create_pull_request',
              'push_files',
              'push_files(owner)',
              'delete_file',
              'fork_repository',
            ],
          },
        },
      }),
    );

    writeFileSync(
      join(tempWorkspace, '.gemini/context.json'),
      JSON.stringify({
        title: 'EDITED_POST_PLAN_TITLE_DO_NOT_TRUST',
        description: 'EDITED_POST_PLAN_BODY_DO_NOT_TRUST',
        issue_number: '42',
      }),
    );

    const eventPath = join(tempWorkspace, 'event.json');
    writeFileSync(
      eventPath,
      JSON.stringify(
        createIssueCommentEvent({
          commentId: 300,
          commentBody:
            '@gemini-cli /approve https://github.com/acme/demo-repo/pull/42#issuecomment-101',
          createdAt: '2026-11-17T18:10:00Z',
          isPullRequestIssueComment: true,
        }),
      ),
    );

    httpServer = createServer((req, res) => {
      if (req.url === '/user') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ message: 'Resource not accessible by integration' }),
        );
        return;
      }
      if (req.url === '/repos/acme/demo-repo/issues/comments/101') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 101,
            issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
            body: SAMPLE_BOT_PLAN_A,
            created_at: '2026-11-17T18:00:00Z',
            updated_at: '2026-11-17T18:00:00Z',
            performed_via_github_app: { id: 55, slug: 'acme-app' },
            user: { login: 'acme-app[bot]', type: 'Bot' },
          }),
        );
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>((resolveListen) =>
      httpServer!.listen(0, '127.0.0.1', () => resolveListen()),
    );
    const { port } = httpServer.address() as AddressInfo;

    const result = await runNodeScript(symlinkedScript, tempWorkspace, {
      GITHUB_EVENT_NAME: 'issue_comment',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'acme/demo-repo',
      GITHUB_API_URL: `http://127.0.0.1:${port}`,
      GITHUB_TOKEN: 'ghs_test_token',
      EXPECTED_PLAN_AUTHOR: '',
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Verified approved plan comment #101');

    const writtenPlan = JSON.parse(
      readFileSync(join(tempWorkspace, '.gemini/approved_plan.json'), 'utf8'),
    );
    expect(writtenPlan.comment_id).toBe(101);
    expect(writtenPlan.author_login).toBe('acme-app[bot]');

    const sanitizedContext = JSON.parse(
      readFileSync(join(tempWorkspace, '.gemini/context.json'), 'utf8'),
    );
    expect(sanitizedContext).toEqual({
      event_name: 'issue_comment',
      is_pull_request: 'true',
      issue_number: '42',
      repository: 'acme/demo-repo',
    });

    const sanitizedSettings = JSON.parse(
      readFileSync(join(tempWorkspace, '.gemini/settings.json'), 'utf8'),
    ) as WorkflowGeminiSettings;
    expect(sanitizedSettings.mcpServers?.['github']?.includeTools).toEqual([
      'add_issue_comment',
      'create_branch',
      'create_or_update_file',
      'create_pull_request',
    ]);
    expect(sanitizedSettings.mcpServers?.['github']?.excludeTools).toEqual(
      expect.arrayContaining([...DISALLOWED_PLAN_EXECUTE_MCP_TOOLS]),
    );

    const geminiIgnoreLines = readFileSync(
      join(tempWorkspace, '.geminiignore'),
      'utf8',
    )
      .trim()
      .split('\n');
    expect(geminiIgnoreLines.slice(-5)).toEqual([
      '!.gemini',
      '!.gemini/',
      '.gemini/*',
      '!.gemini/context.json',
      '!.gemini/approved_plan.json',
    ]);

    const beforeIdempotent = readFileSync(
      join(tempWorkspace, '.geminiignore'),
      'utf8',
    );
    ensureGeminiIgnoreAllowsContextFiles(tempWorkspace);
    expect(readFileSync(join(tempWorkspace, '.geminiignore'), 'utf8')).toBe(
      beforeIdempotent,
    );
  });

  it('supports custom PAT /user resolution, rejects mismatched GITHUB_REPOSITORY, and fails closed on API/settings errors', async () => {
    const eventPath = join(tempWorkspace, 'event.json');
    writeFileSync(
      eventPath,
      JSON.stringify(
        createIssueCommentEvent({
          commentId: 300,
          commentBody: '@gemini-cli /approve 101',
        }),
      ),
    );

    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'acme-service-bot' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 101,
            issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
            body: SAMPLE_BOT_PLAN_A,
            created_at: '2026-11-17T18:00:00Z',
            updated_at: '2026-11-17T18:00:00Z',
            user: { login: 'acme-service-bot', type: 'User' },
          }),
          { status: 200 },
        ),
      );

    const verified = await verifyAndWriteApprovedPlan({
      workspaceRoot: tempWorkspace,
      eventName: 'issue_comment',
      eventPath,
      expectedPlanAuthor: '',
      githubToken: 'ghp_pat_token',
      fetchImpl: mockFetch,
    });
    expect(verified.author_login).toBe('acme-service-bot');

    await expect(
      verifyAndWriteApprovedPlan({
        workspaceRoot: tempWorkspace,
        eventName: 'issue_comment',
        eventPath,
        repository: 'other/repo',
        githubToken: 'ghp_pat_token',
        fetchImpl: mockFetch,
      }),
    ).rejects.toThrow(/does not match event payload repository/);

    const unauthFetchSpy = vi.fn<typeof fetch>();
    await expect(
      verifyAndWriteApprovedPlan({
        workspaceRoot: tempWorkspace,
        eventName: 'issue_comment',
        eventPath,
        expectedPlanAuthor: '',
        githubToken: '',
        fetchImpl: unauthFetchSpy,
      }),
    ).rejects.toThrow(/GITHUB_TOKEN is required/);
    expect(unauthFetchSpy).not.toHaveBeenCalled();

    const notFoundFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Not Found', { status: 404 }));
    await expect(
      fetchIssueCommentById({
        apiBaseUrl: 'https://api.github.com',
        repository: 'acme/demo-repo',
        commentId: 999,
        issueNumber: 42,
        githubToken: 'ghs_test_token',
        fetchImpl: notFoundFetch,
      }),
    ).rejects.toThrow(/was not found on issue #42/);

    for (const badSlug of ['acme/..', '../victim', './victim']) {
      await expect(
        fetchIssueCommentById({
          apiBaseUrl: 'https://api.github.com',
          repository: badSlug,
          commentId: 100,
          issueNumber: 42,
          githubToken: 'ghs_test_token',
          fetchImpl: notFoundFetch,
        }),
      ).rejects.toThrow(/Invalid repository slug/);
    }

    mkdirSync(join(tempWorkspace, '.gemini'), { recursive: true });
    writeFileSync(join(tempWorkspace, '.gemini/settings.json'), '{corrupt');
    expect(() => sanitizePlanExecuteSettingsFile(tempWorkspace)).toThrow(
      /Failed to parse \.gemini\/settings\.json/,
    );
  });

  it('exits non-zero when CLI verification fails and does not auto-execute on ES module import', async () => {
    const scriptPath = resolve(REPO_ROOT, 'scripts/resolve-approved-plan.mjs');
    const failResult = await runNodeScript(scriptPath, tempWorkspace, {
      GITHUB_EVENT_PATH: join(tempWorkspace, 'missing-event.json'),
    });
    expect(failResult.code).toBe(1);
    expect(failResult.stderr).toContain(
      '::error title=Plan verification failed::',
    );

    const moduleUrl = new URL(
      '../scripts/resolve-approved-plan.mjs',
      import.meta.url,
    ).href;
    const importResult = await runNodeScript(
      '--input-type=module',
      tempWorkspace,
      {},
      [
        '-e',
        `import(${JSON.stringify(moduleUrl)}).then((m) => console.log(typeof m.selectVerifiedPlan));`,
        '--',
        '--verify',
      ],
    );
    expect(importResult.code).toBe(0);
    expect(importResult.stdout.trim()).toBe('function');
  });

  it('synthesizes .gemini/context.json for legacy @v0 gemini-invoke runs and excludes untracked .geminiignore in .git/info/exclude', async () => {
    mkdirSync(join(tempWorkspace, '.git/info'), { recursive: true });

    // Non-invoke runs never synthesize untrusted TITLE/DESCRIPTION
    prepareContextAndGeminiIgnore({
      workspaceRoot: tempWorkspace,
      env: {
        WORKFLOW_NAME: 'gemini-plan-execute',
        TITLE: 'Untrusted',
        DESCRIPTION: 'Untrusted',
        REPOSITORY: 'acme/demo-repo',
      },
    });
    expect(existsSync(join(tempWorkspace, '.gemini/context.json'))).toBe(false);
    expect(existsSync(join(tempWorkspace, '.geminiignore'))).toBe(false);

    // Legacy @v0 gemini-invoke run via CLI --ensure-geminiignore synthesizes context.json and updates .git/info/exclude
    const scriptPath = resolve(REPO_ROOT, 'scripts/resolve-approved-plan.mjs');
    const cliResult = await runNodeScript(
      scriptPath,
      tempWorkspace,
      {
        WORKFLOW_NAME: 'gemini-invoke',
        PROMPT_INPUT: '/gemini-invoke',
        TITLE: 'Add caching',
        DESCRIPTION: 'Please propose a plan.',
        EVENT_NAME: 'issue_comment',
        IS_PULL_REQUEST: 'false',
        ISSUE_NUMBER: '77',
        REPOSITORY: 'acme/demo-repo',
        ADDITIONAL_CONTEXT: 'focus on memory bounds',
      },
      ['--ensure-geminiignore'],
    );
    expect(cliResult.code).toBe(0);

    const synthesized = JSON.parse(
      readFileSync(join(tempWorkspace, '.gemini/context.json'), 'utf8'),
    );
    expect(synthesized).toEqual({
      title: 'Add caching',
      description: 'Please propose a plan.',
      event_name: 'issue_comment',
      is_pull_request: 'false',
      issue_number: '77',
      repository: 'acme/demo-repo',
      additional_context: 'focus on memory bounds',
    });
    expect(
      readFileSync(join(tempWorkspace, '.geminiignore'), 'utf8'),
    ).toContain('!.gemini/context.json');
    expect(
      readFileSync(join(tempWorkspace, '.git/info/exclude'), 'utf8'),
    ).toContain('/.geminiignore');
  });
});

function runNodeScript(
  scriptOrFlag: string,
  cwd: string,
  extraEnv: Record<string, string>,
  extraArgs: string[] = [],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const cleanBaseEnv: Record<string, string | undefined> = { ...process.env };
  for (const key of AMBIENT_GITHUB_ENV_KEYS) {
    delete cleanBaseEnv[key];
  }
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptOrFlag, ...extraArgs], {
      cwd,
      env: { ...cleanBaseEnv, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, stdout, stderr }));
  });
}
