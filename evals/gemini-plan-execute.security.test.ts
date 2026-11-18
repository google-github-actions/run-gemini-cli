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
  realpathSync,
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
  httpUrl?: string;
}

interface WorkflowGeminiSettings {
  mcpServers?: Record<string, McpServerSettings>;
  tools?: {
    core?: string[];
    allowed?: string[];
  };
}

const REPO_ROOT = resolve(__dirname, '..');

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

const DISPATCH_WORKFLOWS = [
  '.github/workflows/gemini-dispatch.yml',
  'examples/workflows/gemini-dispatch/gemini-dispatch.yml',
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
  issueTitle?: string;
  issueBody?: string;
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
      title: overrides?.issueTitle ?? 'Improve documentation',
      body: overrides?.issueBody ?? 'Please clarify setup steps.',
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

  it('keeps shipped and example assistant workflows and TOML templates synchronized', () => {
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
    expect(
      readRepoFile('.github/workflows/gemini-invoke.yml').replace(
        "uses: './'",
        "uses: 'google-github-actions/run-gemini-cli@v0' # ratchet:exclude",
      ),
    ).toBe(
      readRepoFile('examples/workflows/gemini-assistant/gemini-invoke.yml'),
    );

    for (const wfPath of [
      '.github/workflows/gemini-invoke.yml',
      '.github/workflows/gemini-plan-execute.yml',
      'examples/workflows/gemini-assistant/gemini-invoke.yml',
      'examples/workflows/gemini-assistant/gemini-plan-execute.yml',
    ]) {
      expect(readRepoFile(wfPath)).toContain(
        "ref: '${{ github.event.repository.default_branch }}'",
      );
    }

    for (const wfPath of [
      '.github/workflows/ci.yml',
      '.github/workflows/gemini-invoke.yml',
      '.github/workflows/gemini-plan-execute.yml',
    ]) {
      const usesLines = readRepoFile(wfPath)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('uses:'));
      expect(usesLines.length).toBeGreaterThan(0);
      for (const usesLine of usesLines) {
        if (usesLine === "uses: './'") {
          continue;
        }
        expect(usesLine).toMatch(/@[0-9a-f]{40}'/);
      }
    }

    for (const tomlPath of [...PLAN_EXECUTE_TOMLS, ...INVOKE_TOMLS]) {
      const toml = readRepoFile(tomlPath);
      expect(toml).not.toMatch(
        /!\{echo\s+\$(TITLE|DESCRIPTION|ADDITIONAL_CONTEXT)\}/,
      );
    }

    for (const invokePath of INVOKE_TOMLS) {
      expect(readRepoFile(invokePath)).toContain(
        '@gemini-cli /approve <comment-url-or-id>',
      );
    }
  });

  it('deterministically validates approved plan provenance with fail-closed artifact check in action.yml', () => {
    const actionYaml = readRepoFile('action.yml');
    expect(actionYaml).toContain("name: 'Verify approved plan'");
    expect(actionYaml).toContain(
      'node "${GITHUB_ACTION_PATH}/scripts/resolve-approved-plan.mjs" --verify',
    );
    expect(actionYaml).toContain(
      'if [[ -L ".gemini" || -L ".gemini/settings.json" ]]',
    );
    expect(actionYaml).toContain(
      'if [[ -L ".gemini" || -L ".gemini/commands" ]]',
    );
    expect(actionYaml).toContain('rm -f .gemini/approved_plan.json');
    expect(actionYaml).toContain('if [[ ! -s ".gemini/approved_plan.json" ]]');

    for (const workflowPath of PLAN_EXECUTE_WORKFLOWS) {
      const planExecuteYaml = readRepoFile(workflowPath);
      expect(planExecuteYaml).toContain('EXPECTED_PLAN_AUTHOR');
    }
  });

  it('keeps runtime exports in 1:1 parity with scripts/resolve-approved-plan.d.mts', () => {
    const dts = readRepoFile('scripts/resolve-approved-plan.d.mts');
    const declaredValueExports = Array.from(
      dts.matchAll(/^export\s+(?:const|class|function)\s+([A-Za-z0-9_]+)/gm),
      (match) => match[1],
    ).sort();
    const runtimeValueExports = Object.keys(planVerifierModule).sort();
    expect(runtimeValueExports).toEqual(declaredValueExports);
  });

  it.each(DISPATCH_WORKFLOWS)(
    'enforces word-boundary on /approve and forwards arguments as additional_context in %s',
    (dispatchPath) => {
      const dispatchYaml = readRepoFile(dispatchPath);
      expect(dispatchYaml).toContain(
        '/^@gemini-cli \\/approve(?:\\s|$)/.test(request)',
      );
      expect(dispatchYaml).toMatch(
        /request\.replace\(\/\^@gemini-cli \\\/approve\/,\s*''\)\.trim\(\)/,
      );
    },
  );
});

describe('parseApprovalDirective & computePlanSha256', () => {
  it('normalizes CRLF line endings identically to LF in computePlanSha256', () => {
    const lf = '## 🤖 AI Assistant: Plan of Action\n\n- [ ] Step 1\n';
    const crlf = '## 🤖 AI Assistant: Plan of Action\r\n\r\n- [ ] Step 1\r\n';
    expect(computePlanSha256(crlf)).toBe(computePlanSha256(lf));
  });

  it('parses bare @gemini-cli /approve with targetCommentId = null', () => {
    expect(parseApprovalDirective('@gemini-cli /approve')).toEqual({
      targetCommentId: null,
      targetSha256Prefix: null,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: '',
    });
  });

  it('parses numeric comment ID, fragment, PR/Issue URL, and sha256 binding tokens', () => {
    expect(parseApprovalDirective('@gemini-cli /approve 123456')).toEqual({
      targetCommentId: 123456,
      targetSha256Prefix: null,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: '',
    });

    expect(
      parseApprovalDirective('@gemini-cli /approve #issuecomment-789012'),
    ).toEqual({
      targetCommentId: 789012,
      targetSha256Prefix: null,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: '',
    });

    expect(
      parseApprovalDirective(
        '@gemini-cli /approve https://github.com/acme/demo-repo/pull/42#issuecomment-345678 sha256:ABCDEF012345 proceed',
      ),
    ).toEqual({
      targetCommentId: 345678,
      targetSha256Prefix: 'abcdef012345',
      urlRepository: 'acme/demo-repo',
      urlIssueNumber: 42,
      additionalContext: 'proceed',
    });

    expect(
      parseApprovalDirective(
        '@gemini-cli /approve https://github.com/acme/demo-repo/issues/42?notification_referrer_id=NT_kwDOA#issuecomment-345678',
      ),
    ).toEqual({
      targetCommentId: 345678,
      targetSha256Prefix: null,
      urlRepository: 'acme/demo-repo',
      urlIssueNumber: 42,
      additionalContext: '',
    });
  });

  it('rejects duplicate comment IDs, duplicate/malformed sha256 tokens, trailing binding tokens after prose, and malformed URLs', () => {
    expect(() =>
      parseApprovalDirective('@gemini-cli /approve 100 200'),
    ).toThrow(/Duplicate plan comment ID/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve 100 sha256:abcdef12 sha256:12345678',
      ),
    ).toThrow(/Duplicate sha256/);
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
      parseApprovalDirective('@gemini-cli /approve 100 sha256:abc12'),
    ).toThrow(PlanVerificationError);
    expect(() =>
      parseApprovalDirective('@gemini-cli /approve 100 sha256:abcdef123456.'),
    ).toThrow(/Invalid sha256 digest token/);
    expect(() =>
      parseApprovalDirective('@gemini-cli /approve 100 sha256:0xabcdef12'),
    ).toThrow(/Invalid sha256 digest token/);
    expect(() =>
      parseApprovalDirective(
        `@gemini-cli /approve 100 sha256:${'a'.repeat(65)}`,
      ),
    ).toThrow(/cannot exceed 64 hex characters/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve 100 looks good #issuecomment-200',
      ),
    ).toThrow(/must appear immediately after/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve should NOT be run on #issuecomment-100',
      ),
    ).toThrow(/must appear immediately after/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve do not execute https://github.com/acme/demo-repo/issues/42#issuecomment-100',
      ),
    ).toThrow(/must appear immediately after/);
    expect(() =>
      parseApprovalDirective(
        '@gemini-cli /approve 100 ignore sha256:abcdef123456',
      ),
    ).toThrow(/must appear immediately after/);

    // Ordinary numbers in trailing free-form prose do not trigger duplicate ID errors
    expect(
      parseApprovalDirective('@gemini-cli /approve 100 looks good for step 1'),
    ).toEqual({
      targetCommentId: 100,
      targetSha256Prefix: null,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: 'looks good for step 1',
    });
  });

  it('rejects non-approval comments and prefix-spoofed commands', () => {
    expect(parseApprovalDirective('@gemini-cli /review')).toBeNull();
    expect(parseApprovalDirective('@gemini-cli /approved')).toBeNull();
    expect(
      parseApprovalDirective('Please run @gemini-cli /approve 100'),
    ).toBeNull();
    expect(parseApprovalDirective(null)).toBeNull();
  });
});

describe('extractApprovalContext', () => {
  it('detects PR conversation comments via event.issue.pull_request', () => {
    const event = createIssueCommentEvent({
      commentId: 500,
      isPullRequestIssueComment: true,
    });
    const ctx = extractApprovalContext('issue_comment', event);

    expect(ctx.issueNumber).toBe(42);
    expect(ctx.isPullRequest).toBe(true);
    expect(ctx.sharesIssueCommentIdSpace).toBe(true);
  });

  it('supports pull_request_review and pull_request_review_comment events without conflating IDs', () => {
    const prReviewEvent = {
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
    };
    const reviewCtx = extractApprovalContext(
      'pull_request_review',
      prReviewEvent,
    );
    expect(reviewCtx.isPullRequest).toBe(true);
    expect(reviewCtx.sharesIssueCommentIdSpace).toBe(false);

    const prDiffCommentEvent = {
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
    };
    const diffCtx = extractApprovalContext(
      'pull_request_review_comment',
      prDiffCommentEvent,
    );
    expect(diffCtx.isPullRequest).toBe(true);
    expect(diffCtx.sharesIssueCommentIdSpace).toBe(false);
  });

  it('rejects edited/deleted comment actions and dismissed review actions', () => {
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

  it('rejects non-User sender types and missing/invalid approval IDs', () => {
    const event = createIssueCommentEvent({ senderType: 'Bot' });
    expect(() => extractApprovalContext('issue_comment', event)).toThrow(
      PlanVerificationError,
    );

    const zeroIdEvent = createIssueCommentEvent({ commentId: 0 });
    expect(() => extractApprovalContext('issue_comment', zeroIdEvent)).toThrow(
      /Missing or invalid approval event ID/,
    );
  });
});

describe('selectVerifiedPlan (TOCTOU, URL spoofing & provenance defenses)', () => {
  const defaultTrusted = resolveTrustedPlanAuthors('');

  it('rejects bare @gemini-cli /approve without an explicit comment ID/URL binding', () => {
    const bareApproval = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 200,
        commentBody: '@gemini-cli /approve',
      }),
    );
    const comment = {
      id: 100,
      body: SAMPLE_BOT_PLAN_A,
      created_at: '2026-11-17T18:00:00Z',
      updated_at: '2026-11-17T18:00:00Z',
      user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
    };

    expect(() =>
      selectVerifiedPlan(comment, bareApproval, defaultTrusted),
    ).toThrow(/must bind to a specific plan comment ID or URL/i);
  });

  it('prevents [T_read, T_approve] TOCTOU swap and same-second post-approval race', () => {
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
      id: 201, // id >= approvalId (200) despite identical 1-second timestamp
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

  it('rejects cross-repo URLs, cross-issue URLs, cross-issue API issue_url, and non-heading bot comments', () => {
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
        {
          ...validComment,
          issue_url: '',
        },
        standardApproval,
        defaultTrusted,
      ),
    ).toThrow(/missing a valid issue_url/);

    expect(() =>
      selectVerifiedPlan(
        {
          ...validComment,
          issue_url: 'not-a-valid-url',
        },
        standardApproval,
        defaultTrusted,
      ),
    ).toThrow(/malformed issue_url/);

    expect(() =>
      selectVerifiedPlan(
        {
          ...validComment,
          body: '🤖 Hi @alice, I mentioned AI Assistant: Plan of Action in prose without a heading.',
        },
        standardApproval,
        defaultTrusted,
      ),
    ).toThrow(/does not contain a Markdown heading/);

    // Fails closed if repository slug is missing or starts with dot-segments
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

  it('rejects untrusted authors (including ghu_ user-to-server tokens), matches EXPECTED_PLAN_AUTHOR case-insensitively, and supports @v0 installed GitHub App bots', () => {
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
    const verifiedAppPlan = selectVerifiedPlan(
      installedAppBotComment,
      approval,
      defaultTrusted,
      { allowInstalledGithubAppBots: true },
    );
    expect(verifiedAppPlan.author_login).toBe('acme-custom-app[bot]');

    // Case-insensitive EXPECTED_PLAN_AUTHOR matching
    const mixedCaseTrusted = resolveTrustedPlanAuthors('Acme-Custom-App[BOT]');
    expect(
      selectVerifiedPlan(installedAppBotComment, approval, mixedCaseTrusted)
        .author_login,
    ).toBe('acme-custom-app[bot]');

    // When EXPECTED_PLAN_AUTHOR is explicitly pinned, other bots are rejected
    const pinnedTrusted = resolveTrustedPlanAuthors('expected-app[bot]');
    expect(() =>
      selectVerifiedPlan(installedAppBotComment, approval, pinnedTrusted, {
        allowInstalledGithubAppBots: false,
      }),
    ).toThrow(/not an authorized plan bot/);
  });

  it('rejects pre-approval in-place edits without sha256 (printing digest hint) and rejects post-approval edits always', () => {
    const editedBeforeApproval = {
      id: 100,
      issue_url: 'https://api.github.com/repos/acme/demo-repo/issues/42',
      body: SAMPLE_BOT_PLAN_B,
      created_at: '2026-11-17T18:00:00Z',
      updated_at: '2026-11-17T18:04:00Z',
      user: { login: DEFAULT_BOT_LOGIN, type: 'Bot' },
    };
    const expectedHint = computePlanSha256(SAMPLE_BOT_PLAN_B).slice(0, 12);

    const approvalWithoutHash = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 200,
        commentBody: '@gemini-cli /approve 100',
      }),
    );
    expect(() =>
      selectVerifiedPlan(
        editedBeforeApproval,
        approvalWithoutHash,
        defaultTrusted,
      ),
    ).toThrow(`sha256:${expectedHint}`);

    const approvalWithHash = extractApprovalContext(
      'issue_comment',
      createIssueCommentEvent({
        commentId: 200,
        commentBody: `@gemini-cli /approve 100 sha256:${expectedHint}`,
      }),
    );
    expect(
      selectVerifiedPlan(editedBeforeApproval, approvalWithHash, defaultTrusted)
        .comment_id,
    ).toBe(100);

    const editedAfterApproval = {
      ...editedBeforeApproval,
      updated_at: '2026-11-17T18:10:05Z',
    };
    expect(() =>
      selectVerifiedPlan(editedAfterApproval, approvalWithHash, defaultTrusted),
    ).toThrow(/created or modified after approval/i);
  });
});

describe('End-to-end verification (O(1) HTTP API, symlinked runner, settings pruning & .geminiignore ordering)', () => {
  let tempWorkspace = '';
  let symlinkRoot = '';
  let httpServer: Server | null = null;

  beforeEach(() => {
    tempWorkspace = mkdtempSync(join(tmpdir(), 'plan-verify-e2e-'));
    symlinkRoot = mkdtempSync(join(tmpdir(), 'plan-verify-symlink-'));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
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

  it('executes via a symlinked action path (macOS /var -> /private/var simulation), sanitizes settings.json & context.json, and updates .git/info/exclude', async () => {
    const symlinkedRepo = join(symlinkRoot, 'action-link');
    symlinkSync(REPO_ROOT, symlinkedRepo);
    const symlinkedScript = join(
      symlinkedRepo,
      'scripts/resolve-approved-plan.mjs',
    );

    mkdirSync(join(tempWorkspace, '.git/info'), { recursive: true });
    mkdirSync(join(tempWorkspace, '.gemini'), { recursive: true });
    writeFileSync(join(tempWorkspace, '.gitignore'), '.gemini/\n');

    // Pre-existing .geminiignore with conflicting partial lines and *.json rule
    writeFileSync(
      join(tempWorkspace, '.geminiignore'),
      '!.gemini/\n!.gemini/context.json\n*.json\n',
    );

    // Pre-existing @v0 consumer settings.json with excess MCP tools
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
    const baseUrl = `http://127.0.0.1:${port}`;

    // Invoke via symlink WITHOUT --verify flag to prove isExecutedAsMainScript resolves symlinks
    const result = await runNodeScript(symlinkedScript, tempWorkspace, {
      GITHUB_EVENT_NAME: 'issue_comment',
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'acme/demo-repo',
      GITHUB_API_URL: baseUrl,
      GITHUB_TOKEN: 'ghs_test_token',
      EXPECTED_PLAN_AUTHOR: '', // Simulate @v0 consumer without EXPECTED_PLAN_AUTHOR
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

    // Windows backslash path normalization remains idempotent
    const beforeIdempotent = readFileSync(
      join(tempWorkspace, '.geminiignore'),
      'utf8',
    );
    ensureGeminiIgnoreAllowsContextFiles(
      tempWorkspace,
      '.gemini\\approved_plan.json',
    );
    expect(readFileSync(join(tempWorkspace, '.geminiignore'), 'utf8')).toBe(
      beforeIdempotent,
    );

    // Creating a fresh untracked .geminiignore in a clean repo registers /.geminiignore in .git/info/exclude
    rmSync(join(tempWorkspace, '.geminiignore'));
    const ensureResult = await runNodeScript(
      symlinkedScript,
      tempWorkspace,
      {},
      ['--ensure-geminiignore'],
    );
    expect(ensureResult.code).toBe(0);
    expect(
      readFileSync(join(tempWorkspace, '.git/info/exclude'), 'utf8'),
    ).toContain('/.geminiignore');
  });

  it('fails closed via symlinked path when verification fails and rejects symlinked .gemini directory', async () => {
    const symlinkedRepo = join(symlinkRoot, 'action-link-fail');
    symlinkSync(REPO_ROOT, symlinkedRepo);
    const symlinkedScript = join(
      symlinkedRepo,
      'scripts/resolve-approved-plan.mjs',
    );

    const failResult = await runNodeScript(symlinkedScript, tempWorkspace, {
      GITHUB_EVENT_PATH: join(tempWorkspace, 'missing-event.json'),
    });
    expect(failResult.code).toBe(1);
    expect(failResult.stderr).toContain(
      '::error title=Plan verification failed::',
    );

    // Symlinked .gemini directory is rejected before any file clobber
    const outsideDir = mkdtempSync(join(tmpdir(), 'outside-target-'));
    try {
      symlinkSync(outsideDir, join(tempWorkspace, '.gemini'));
      expect(() => sanitizePlanExecuteSettingsFile(tempWorkspace)).toThrow(
        /symlinked directory/,
      );
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('supports custom PAT user resolution in verifyAndWriteApprovedPlan and handles 404/403 in fetchIssueCommentById', async () => {
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

    // Rejects leading/trailing dot-segment repository slugs, rate-limited 403, non-JSON 200, and missing issue_url
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

    const rateLimitedFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Forbidden', {
        status: 403,
        statusText: '',
        headers: { 'x-ratelimit-remaining': '0' },
      }),
    );
    await expect(
      fetchIssueCommentById({
        apiBaseUrl: 'https://api.github.com',
        repository: 'acme/demo-repo',
        commentId: 101,
        issueNumber: 42,
        githubToken: 'ghs_test_token',
        fetchImpl: rateLimitedFetch,
      }),
    ).rejects.toThrow(/\(403; GitHub API rate limit exceeded\)/);

    const htmlProxyFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>Gateway</html>', { status: 200 }));
    await expect(
      fetchIssueCommentById({
        apiBaseUrl: 'https://api.github.com',
        repository: 'acme/demo-repo',
        commentId: 101,
        issueNumber: 42,
        githubToken: 'ghs_test_token',
        fetchImpl: htmlProxyFetch,
      }),
    ).rejects.toThrow(/GitHub API returned invalid JSON/);

    const missingIssueUrlFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 101 }), { status: 200 }),
      );
    await expect(
      fetchIssueCommentById({
        apiBaseUrl: 'https://api.github.com',
        repository: 'acme/demo-repo',
        commentId: 101,
        issueNumber: 42,
        githubToken: 'ghs_test_token',
        fetchImpl: missingIssueUrlFetch,
      }),
    ).rejects.toThrow(/missing a valid issue_url/);
  });

  it('synthesizes .gemini/context.json for legacy @v0 gemini-invoke env vars while skipping plain/plan-execute runs', () => {
    // Plain ad-hoc run without legacy env vars or context.json is a clean no-op
    prepareContextAndGeminiIgnore({
      workspaceRoot: tempWorkspace,
      env: { GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'acme/demo-repo' },
      workflowName: '',
      promptInput: 'Explain src/index.ts',
    });
    expect(existsSync(join(tempWorkspace, '.gemini/context.json'))).toBe(false);
    expect(existsSync(join(tempWorkspace, '.geminiignore'))).toBe(false);

    // Plan-execute never synthesizes untrusted title/description from env vars
    prepareContextAndGeminiIgnore({
      workspaceRoot: tempWorkspace,
      env: { TITLE: 'Untrusted', DESCRIPTION: 'Untrusted' },
      workflowName: 'gemini-plan-execute',
      promptInput: '/gemini-plan-execute',
    });
    expect(existsSync(join(tempWorkspace, '.gemini/context.json'))).toBe(false);

    // Legacy @v0 gemini-invoke consumer without Prepare prompt context step
    prepareContextAndGeminiIgnore({
      workspaceRoot: tempWorkspace,
      env: {
        TITLE: 'Add caching',
        DESCRIPTION: 'Please propose a plan.',
        EVENT_NAME: 'issue_comment',
        IS_PULL_REQUEST: 'false',
        ISSUE_NUMBER: '77',
        REPOSITORY: 'acme/demo-repo',
        ADDITIONAL_CONTEXT: 'focus on memory bounds',
      },
      workflowName: 'gemini-invoke',
      promptInput: '/gemini-invoke',
    });
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
  });

  it('parses JSONC comments, strips parameterized includeTools, fails closed on corrupt settings.json, and guards module imports', async () => {
    mkdirSync(join(tempWorkspace, '.gemini'), { recursive: true });
    writeFileSync(
      join(tempWorkspace, '.gemini/settings.json'),
      [
        '{',
        '  // Single-line JSONC comment allowed by Gemini CLI',
        '  /* Multi-line JSONC comment */',
        '  "mcpServers": {',
        '    "github": {',
        '      "httpUrl": "https://api.githubcopilot.com/mcp/*keep*/",',
        '      "includeTools": [',
        '        "add_issue_comment",',
        '        "push_files(owner)",',
        '        "issue_read()",',
        '        "create_pull_request"',
        '      ]',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );

    sanitizePlanExecuteSettingsFile(tempWorkspace);
    const parsedJsonc = JSON.parse(
      readFileSync(join(tempWorkspace, '.gemini/settings.json'), 'utf8'),
    ) as WorkflowGeminiSettings;
    expect(parsedJsonc.mcpServers?.['github']?.httpUrl).toBe(
      'https://api.githubcopilot.com/mcp/*keep*/',
    );
    expect(parsedJsonc.mcpServers?.['github']?.includeTools).toEqual([
      'add_issue_comment',
      'create_pull_request',
    ]);
    expect(parsedJsonc.mcpServers?.['github']?.excludeTools).toEqual(
      expect.arrayContaining([...DISALLOWED_PLAN_EXECUTE_MCP_TOOLS]),
    );

    // Corrupt JSON fails closed instead of silently skipping MCP sanitization
    writeFileSync(
      join(tempWorkspace, '.gemini/settings.json'),
      '{ "mcpServers": [corrupt',
    );
    expect(() => sanitizePlanExecuteSettingsFile(tempWorkspace)).toThrow(
      /Failed to parse \.gemini\/settings\.json/,
    );

    writeFileSync(join(tempWorkspace, '.gemini/settings.json'), '[]');
    expect(() => sanitizePlanExecuteSettingsFile(tempWorkspace)).toThrow(
      /expected a JSON object/,
    );

    // Importing resolve-approved-plan.mjs as an ES module does not execute CLI mode even if argv contains --verify
    const moduleUrl = new URL(
      '../scripts/resolve-approved-plan.mjs',
      import.meta.url,
    ).href;
    const importResult = await new Promise<{
      code: number | null;
      stdout: string;
      stderr: string;
    }>((resolveImport, rejectImport) => {
      const child = spawn(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import(${JSON.stringify(moduleUrl)}).then((m) => console.log(typeof m.selectVerifiedPlan));`,
          '--',
          '--verify',
        ],
        { cwd: tempWorkspace, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', rejectImport);
      child.on('close', (code) => resolveImport({ code, stdout, stderr }));
    });
    expect(importResult.code).toBe(0);
    expect(importResult.stdout.trim()).toBe('function');
    expect(importResult.stderr).toBe('');
  });

  it('enforces nested/dangling symlink guards, git worktree HEAD/symlink validation, and excludeTools fallback', () => {
    const outsideDir = realpathSync(
      mkdtempSync(join(tmpdir(), 'outside-nested-')),
    );
    try {
      // Nested path under symlinked .gemini fails closed before mkdirSync
      symlinkSync(outsideDir, join(tempWorkspace, '.gemini'));
      expect(() =>
        ensureGeminiIgnoreAllowsContextFiles(
          tempWorkspace,
          '.gemini/nested/approved_plan.json',
          '.gemini/nested/context.json',
        ),
      ).not.toThrow(); // .geminiignore itself is at root
      rmSync(join(tempWorkspace, '.geminiignore'), { force: true });
      expect(() =>
        prepareContextAndGeminiIgnore({
          workspaceRoot: tempWorkspace,
          env: { TITLE: 'Test' },
          workflowName: 'gemini-invoke',
          contextRelPath: '.gemini/nested/context.json',
        }),
      ).toThrow(/symlinked directory/);

      // Dangling file symlink is rejected on read/write target check
      rmSync(join(tempWorkspace, '.gemini'), { force: true });
      mkdirSync(join(tempWorkspace, '.gemini'), { recursive: true });
      symlinkSync(
        join(outsideDir, 'nonexistent.json'),
        join(tempWorkspace, '.gemini/settings.json'),
      );
      expect(() => sanitizePlanExecuteSettingsFile(tempWorkspace)).toThrow(
        /symlinked file/,
      );
      rmSync(join(tempWorkspace, '.gemini/settings.json'), { force: true });

      // Custom MCP server without includeTools gets excludeTools populated (including merge_pull_request)
      writeFileSync(
        join(tempWorkspace, '.gemini/settings.json'),
        JSON.stringify({
          mcpServers: {
            custom_github: {
              command: 'docker',
            },
          },
        }),
      );
      sanitizePlanExecuteSettingsFile(tempWorkspace);
      const updatedSettings = JSON.parse(
        readFileSync(join(tempWorkspace, '.gemini/settings.json'), 'utf8'),
      );
      expect(updatedSettings.mcpServers.custom_github.excludeTools).toEqual(
        expect.arrayContaining([
          'push_files',
          'delete_file',
          'fork_repository',
          'merge_pull_request',
          'issue_read',
        ]),
      );

      // Non-git directory (missing HEAD) in .git file is ignored and never creates info/exclude
      const nonGitDir = join(outsideDir, 'arbitrary-dir');
      mkdirSync(nonGitDir, { recursive: true });
      writeFileSync(join(tempWorkspace, '.git'), `gitdir: ${nonGitDir}\n`);
      ensureGeminiIgnoreAllowsContextFiles(tempWorkspace);
      expect(existsSync(join(nonGitDir, 'info/exclude'))).toBe(false);
      rmSync(join(tempWorkspace, '.geminiignore'), { force: true });

      // Valid Git worktree (.git file pointing to gitdir with HEAD) registers /.geminiignore in worktree info/exclude
      const fakeGitDir = join(outsideDir, 'worktree-gitdir');
      mkdirSync(join(fakeGitDir, 'info'), { recursive: true });
      writeFileSync(join(fakeGitDir, 'HEAD'), 'ref: refs/heads/main\n');
      writeFileSync(join(tempWorkspace, '.git'), `gitdir: ${fakeGitDir}\n`);
      ensureGeminiIgnoreAllowsContextFiles(
        tempWorkspace,
        '.gemini/approved_plan.json',
        '.gemini/custom_context.json',
      );
      expect(
        readFileSync(join(tempWorkspace, '.geminiignore'), 'utf8'),
      ).toContain('!.gemini/custom_context.json');
      expect(readFileSync(join(fakeGitDir, 'info/exclude'), 'utf8')).toContain(
        '/.geminiignore',
      );

      // Intermediate symlink traversal in gitdir: path is rejected
      rmSync(join(tempWorkspace, '.geminiignore'), { force: true });
      const traversedGitDir = join(outsideDir, 'traversed-gitdir');
      mkdirSync(traversedGitDir, { recursive: true });
      writeFileSync(join(traversedGitDir, 'HEAD'), 'ref: refs/heads/main\n');
      const symlinkHop = join(tempWorkspace, 'hop');
      symlinkSync(outsideDir, symlinkHop);
      writeFileSync(
        join(tempWorkspace, '.git'),
        'gitdir: hop/traversed-gitdir\n',
      );
      ensureGeminiIgnoreAllowsContextFiles(tempWorkspace);
      expect(existsSync(join(traversedGitDir, 'info/exclude'))).toBe(false);
      rmSync(symlinkHop, { force: true });

      // Dangling exclude symlink is safely ignored
      writeFileSync(join(tempWorkspace, '.git'), `gitdir: ${fakeGitDir}\n`);
      rmSync(join(tempWorkspace, '.geminiignore'), { force: true });
      rmSync(join(fakeGitDir, 'info/exclude'), { force: true });
      const danglingTarget = join(outsideDir, 'dangling-exclude-target');
      symlinkSync(danglingTarget, join(fakeGitDir, 'info/exclude'));
      ensureGeminiIgnoreAllowsContextFiles(tempWorkspace);
      expect(existsSync(danglingTarget)).toBe(false);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});

function runNodeScript(
  scriptPath: string,
  cwd: string,
  extraEnv: Record<string, string>,
  extraArgs: string[] = [],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
      cwd,
      env: { ...process.env, ...extraEnv },
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
