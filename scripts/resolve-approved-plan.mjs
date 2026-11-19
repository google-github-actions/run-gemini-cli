// @ts-check
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import console from 'node:console';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

export const PLAN_HEADING_MARKER = 'AI Assistant: Plan of Action';
export const APPROVAL_COMMAND_PREFIX = '@gemini-cli /approve';
export const DEFAULT_BOT_LOGIN = 'github-actions[bot]';
export const DEFAULT_APPROVED_PLAN_PATH = '.gemini/approved_plan.json';
export const DEFAULT_CONTEXT_PATH = '.gemini/context.json';
export const DEFAULT_SETTINGS_PATH = '.gemini/settings.json';

export const DISALLOWED_PLAN_EXECUTE_MCP_TOOLS = Object.freeze([
  'push_files',
  'delete_file',
  'fork_repository',
  'merge_pull_request',
  'issue_read',
  'issue_read.get',
  'issue_read.get_comments',
  'list_issues',
  'search_issues',
]);

const API_TIMEOUT_MS = 30_000;
const ALLOWED_APPROVER_ASSOCIATIONS = new Set([
  'OWNER',
  'MEMBER',
  'COLLABORATOR',
]);
const PLAN_HEADING_REGEX = /^\s*#{1,6}\s+.*AI Assistant:\s*Plan of Action\b/m;
const REPOSITORY_SLUG_PATTERN =
  /^(?!\.\.?\/)[A-Za-z0-9_.-]+\/(?!\.\.?$)[A-Za-z0-9_.-]+$/;
const FULL_COMMENT_URL_PATTERN =
  /^https?:\/\/[^/\s#?]+\/((?!\.\.?\/)[A-Za-z0-9_.-]+\/(?!\.\.?$)[A-Za-z0-9_.-]+)\/(?:issues|pull)\/(\d+)(?:\?[^#\s]*)?#issuecomment-(\d+)$/i;
const SHORT_COMMENT_ID_PATTERN =
  /^(?:#?issuecomment-(\d+)|comment-(\d+)|(\d+))$/i;
const EXPLICIT_TRAILING_COMMENT_ID_PATTERN =
  /^(?:#?issuecomment-(\d+)|comment-(\d+))$/i;

const GEMINI_IGNORE_STANZA = Object.freeze([
  '!.gemini',
  '!.gemini/',
  '.gemini/*',
  `!${DEFAULT_CONTEXT_PATH}`,
  `!${DEFAULT_APPROVED_PLAN_PATH}`,
]);

export class PlanVerificationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'PlanVerificationError';
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {string} rawId
 * @param {string} label
 * @returns {number}
 */
function parsePositiveSafeInt(rawId, label) {
  const parsed = Number.parseInt(rawId, 10);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    String(parsed) !== rawId
  ) {
    throw new PlanVerificationError(`Invalid ${label}: ${rawId}`);
  }
  return parsed;
}

/**
 * @param {unknown} isoString
 * @param {string} label
 * @returns {number}
 */
function parseTimestampMs(isoString, label) {
  if (typeof isoString !== 'string' || isoString.trim() === '') {
    throw new PlanVerificationError(`Missing ${label} timestamp.`);
  }
  const parsed = Date.parse(isoString);
  if (Number.isNaN(parsed)) {
    throw new PlanVerificationError(`Invalid ${label} timestamp: ${isoString}`);
  }
  return parsed;
}

/**
 * @param {string} planBody
 * @returns {string}
 */
export function computePlanSha256(planBody) {
  const normalized = planBody.replace(/\r\n/g, '\n').trim();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * @typedef {{
 *   targetCommentId: number | null;
 *   urlRepository: string | null;
 *   urlIssueNumber: number | null;
 *   additionalContext: string;
 * }} ApprovalDirective
 */

/**
 * @param {unknown} rawBody
 * @returns {ApprovalDirective | null}
 */
export function parseApprovalDirective(rawBody) {
  if (typeof rawBody !== 'string') {
    return null;
  }
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith(APPROVAL_COMMAND_PREFIX)) {
    return null;
  }

  const remainder = trimmed.slice(APPROVAL_COMMAND_PREFIX.length);
  if (remainder.length > 0 && !/^\s/.test(remainder)) {
    return null;
  }

  const tokens = remainder.trim() ? remainder.trim().split(/\s+/) : [];
  if (tokens.length === 0) {
    return {
      targetCommentId: null,
      urlRepository: null,
      urlIssueNumber: null,
      additionalContext: '',
    };
  }

  let targetCommentId = null;
  let urlRepository = null;
  let urlIssueNumber = null;
  let consumed = 0;

  const first = tokens[0];
  const shortMatch = first.match(SHORT_COMMENT_ID_PATTERN);
  if (shortMatch) {
    const rawId = shortMatch[1] ?? shortMatch[2] ?? shortMatch[3];
    targetCommentId = parsePositiveSafeInt(rawId, 'comment ID');
    consumed = 1;
  } else if (/^https?:\/\//i.test(first) || first.includes('#issuecomment-')) {
    const urlMatch = first.match(FULL_COMMENT_URL_PATTERN);
    if (!urlMatch) {
      throw new PlanVerificationError(
        `Invalid GitHub issue/PR comment URL in approval command: ${first}`,
      );
    }
    urlRepository = urlMatch[1];
    urlIssueNumber = parsePositiveSafeInt(urlMatch[2], 'URL issue number');
    targetCommentId = parsePositiveSafeInt(urlMatch[3], 'comment ID');
    consumed = 1;
  }

  const trailingTokens = tokens.slice(consumed);
  if (consumed === 1 && trailingTokens.length > 0) {
    const second = trailingTokens[0];
    if (SHORT_COMMENT_ID_PATTERN.test(second)) {
      throw new PlanVerificationError(
        'Duplicate plan comment ID tokens in approval command.',
      );
    }
  }

  for (const trailing of trailingTokens) {
    if (
      EXPLICIT_TRAILING_COMMENT_ID_PATTERN.test(trailing) ||
      /^https?:\/\//i.test(trailing) ||
      trailing.includes('#issuecomment-')
    ) {
      throw new PlanVerificationError(
        `Comment target "${trailing}" must appear immediately after "${APPROVAL_COMMAND_PREFIX}".`,
      );
    }
  }

  return {
    targetCommentId,
    urlRepository,
    urlIssueNumber,
    additionalContext: trailingTokens.join(' '),
  };
}

/**
 * @typedef {{
 *   eventName: string;
 *   isPullRequest: boolean;
 *   issueNumber: number;
 *   repository: string;
 *   approvalId: number;
 *   sharesIssueCommentIdSpace: boolean;
 *   approvalTimestampMs: number;
 *   approverLogin: string;
 *   directive: ApprovalDirective;
 * }} ApprovalContext
 */

/**
 * @param {string} eventName
 * @param {unknown} eventPayload
 * @returns {ApprovalContext}
 */
export function extractApprovalContext(eventName, eventPayload) {
  if (!isRecord(eventPayload)) {
    throw new PlanVerificationError('GitHub event payload must be an object.');
  }

  const action = eventPayload.action;
  /** @type {Record<string, unknown> | null} */
  let source = null;
  let sharesIssueCommentIdSpace = false;

  if (eventName === 'pull_request_review' && isRecord(eventPayload.review)) {
    if (action !== 'submitted') {
      throw new PlanVerificationError(
        `Unsupported pull_request_review action "${String(action)}"; expected "submitted".`,
      );
    }
    source = eventPayload.review;
  } else if (
    (eventName === 'issue_comment' ||
      eventName === 'pull_request_review_comment') &&
    isRecord(eventPayload.comment)
  ) {
    if (action !== 'created') {
      throw new PlanVerificationError(
        `Unsupported ${eventName} action "${String(action)}"; expected "created".`,
      );
    }
    source = eventPayload.comment;
    sharesIssueCommentIdSpace = eventName === 'issue_comment';
  } else {
    throw new PlanVerificationError(
      `Unsupported approval event payload for event "${eventName}".`,
    );
  }

  const sourceUser = isRecord(source.user) ? source.user : null;
  const senderType = isRecord(eventPayload.sender)
    ? eventPayload.sender.type
    : sourceUser?.type;
  const association = String(source.author_association ?? '');

  if (
    senderType !== 'User' ||
    !ALLOWED_APPROVER_ASSOCIATIONS.has(association)
  ) {
    throw new PlanVerificationError(
      `Approver lacks required repository association (${association}).`,
    );
  }

  const directive = parseApprovalDirective(source.body);
  if (!directive) {
    throw new PlanVerificationError(
      'Triggering comment does not start with "@gemini-cli /approve".',
    );
  }

  const hasTopLevelPr = isRecord(eventPayload.pull_request);
  const hasIssuePr =
    isRecord(eventPayload.issue) && isRecord(eventPayload.issue.pull_request);
  const issueObj = hasTopLevelPr
    ? eventPayload.pull_request
    : eventPayload.issue;
  const issueNumber = isRecord(issueObj) ? issueObj.number : undefined;
  if (
    typeof issueNumber !== 'number' ||
    !Number.isSafeInteger(issueNumber) ||
    issueNumber <= 0
  ) {
    throw new PlanVerificationError(
      'Unable to determine target issue or PR number.',
    );
  }

  if (
    typeof source.id !== 'number' ||
    !Number.isSafeInteger(source.id) ||
    source.id <= 0
  ) {
    throw new PlanVerificationError('Missing or invalid approval event ID.');
  }

  return {
    eventName,
    isPullRequest: hasTopLevelPr || hasIssuePr,
    issueNumber,
    repository: isRecord(eventPayload.repository)
      ? String(eventPayload.repository.full_name ?? '')
      : '',
    approvalId: source.id,
    sharesIssueCommentIdSpace,
    approvalTimestampMs: parseTimestampMs(
      source.created_at ?? source.submitted_at,
      'approval',
    ),
    approverLogin: sourceUser ? String(sourceUser.login ?? '') : '',
    directive,
  };
}

/**
 * @param {string} [expectedPlanAuthor]
 * @returns {Set<string>}
 */
export function resolveTrustedPlanAuthors(expectedPlanAuthor) {
  const normalized =
    typeof expectedPlanAuthor === 'string' ? expectedPlanAuthor.trim() : '';
  if (!normalized) {
    return new Set([DEFAULT_BOT_LOGIN.toLowerCase()]);
  }
  const logins = normalized
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(
    logins.length > 0 ? logins : [DEFAULT_BOT_LOGIN.toLowerCase()],
  );
}

/**
 * @typedef {{
 *   verified: true;
 *   comment_id: number;
 *   author_login: string;
 *   created_at: string;
 *   updated_at: string;
 *   approved_by: string;
 *   sha256: string;
 *   plan: string;
 * }} VerifiedPlanRecord
 */

/**
 * @param {unknown} commentsOrSingle
 * @param {ApprovalContext} approvalContext
 * @param {Set<string>} trustedAuthors
 * @param {{ allowInstalledGithubAppBots?: boolean; targetRepository?: string }} [options]
 * @returns {VerifiedPlanRecord}
 */
export function selectVerifiedPlan(
  commentsOrSingle,
  approvalContext,
  trustedAuthors,
  options = {},
) {
  const { targetCommentId, urlRepository, urlIssueNumber } =
    approvalContext.directive;
  if (targetCommentId === null) {
    throw new PlanVerificationError(
      'Approval must bind to a specific plan comment ID or URL (for example, "@gemini-cli /approve <comment-url-or-id>"). Bare "@gemini-cli /approve" is rejected to prevent TOCTOU plan substitution.',
    );
  }

  const repoForCheck = options.targetRepository ?? approvalContext.repository;
  if (!repoForCheck || !REPOSITORY_SLUG_PATTERN.test(repoForCheck)) {
    throw new PlanVerificationError(
      `Unable to determine valid target GitHub repository ("${String(repoForCheck ?? '')}").`,
    );
  }
  if (
    urlRepository !== null &&
    urlRepository.toLowerCase() !== repoForCheck.toLowerCase()
  ) {
    throw new PlanVerificationError(
      `Approval URL repository "${urlRepository}" does not match current repository "${repoForCheck}".`,
    );
  }
  if (
    urlIssueNumber !== null &&
    urlIssueNumber !== approvalContext.issueNumber
  ) {
    throw new PlanVerificationError(
      `Approval URL issue #${urlIssueNumber} does not match current issue #${approvalContext.issueNumber}.`,
    );
  }

  const candidates = Array.isArray(commentsOrSingle)
    ? commentsOrSingle
    : [commentsOrSingle];
  const target = candidates.find(
    (item) => isRecord(item) && item.id === targetCommentId,
  );
  if (!isRecord(target)) {
    throw new PlanVerificationError(
      `Approved plan comment #${targetCommentId} was not found on issue #${approvalContext.issueNumber}.`,
    );
  }

  if (typeof target.issue_url !== 'string' || target.issue_url.trim() === '') {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} is missing a valid issue_url for cross-issue verification.`,
    );
  }
  let issueUrlPathname;
  try {
    issueUrlPathname = new URL(target.issue_url).pathname.toLowerCase();
  } catch {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} has a malformed issue_url (${target.issue_url}).`,
    );
  }
  const expectedSuffix = `/repos/${repoForCheck.toLowerCase()}/issues/${approvalContext.issueNumber}`;
  if (!issueUrlPathname.endsWith(expectedSuffix)) {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} belongs to a different issue (${target.issue_url}).`,
    );
  }

  if (
    typeof target.body !== 'string' ||
    !PLAN_HEADING_REGEX.test(target.body)
  ) {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} does not contain a Markdown heading for "${PLAN_HEADING_MARKER}".`,
    );
  }

  const user = isRecord(target.user) ? target.user : null;
  const authorLogin = typeof user?.login === 'string' ? user.login : '';
  const normalizedLogin = authorLogin.toLowerCase();
  const normalizedTrusted = new Set(
    Array.from(trustedAuthors, (entry) => entry.toLowerCase()),
  );
  const isTrustedAuthor =
    (normalizedLogin !== '' && normalizedTrusted.has(normalizedLogin)) ||
    (Boolean(options.allowInstalledGithubAppBots) &&
      user?.type === 'Bot' &&
      normalizedLogin.endsWith('[bot]') &&
      isRecord(target.performed_via_github_app));

  if (!isTrustedAuthor) {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} author "${authorLogin}" is not an authorized plan bot ([${Array.from(trustedAuthors).join(', ')}]).`,
    );
  }

  if (
    approvalContext.sharesIssueCommentIdSpace &&
    typeof target.id === 'number' &&
    target.id >= approvalContext.approvalId
  ) {
    throw new PlanVerificationError(
      `Comment #${target.id} was created after approval comment #${approvalContext.approvalId}.`,
    );
  }

  const createdAt = String(target.created_at ?? '');
  const updatedAt = String(target.updated_at ?? target.created_at ?? '');
  const createdMs = parseTimestampMs(createdAt, 'plan created_at');
  const updatedMs = parseTimestampMs(updatedAt, 'plan updated_at');
  if (
    createdMs > approvalContext.approvalTimestampMs ||
    updatedMs > approvalContext.approvalTimestampMs
  ) {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} was created or modified after approval.`,
    );
  }
  if (updatedMs !== createdMs) {
    throw new PlanVerificationError(
      `Comment #${targetCommentId} was edited after creation; please generate a fresh plan comment before approving.`,
    );
  }

  return {
    verified: true,
    comment_id: targetCommentId,
    author_login: authorLogin,
    created_at: createdAt,
    updated_at: updatedAt,
    approved_by: approvalContext.approverLogin,
    sha256: computePlanSha256(target.body),
    plan: target.body,
  };
}

/**
 * @param {{
 *   apiBaseUrl: string;
 *   repository: string;
 *   commentId: number;
 *   issueNumber: number;
 *   githubToken: string;
 *   fetchImpl?: typeof fetch;
 * }} params
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchIssueCommentById({
  apiBaseUrl,
  repository,
  commentId,
  issueNumber,
  githubToken,
  fetchImpl = globalThis.fetch,
}) {
  if (!githubToken) {
    throw new PlanVerificationError(
      'GITHUB_TOKEN is required to verify the approved plan.',
    );
  }
  if (!REPOSITORY_SLUG_PATTERN.test(repository)) {
    throw new PlanVerificationError(
      `Invalid repository slug: "${repository}".`,
    );
  }

  const url = `${apiBaseUrl.replace(/\/$/, '')}/repos/${repository}/issues/comments/${commentId}`;
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
    signal: globalThis.AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (response.status === 404) {
    throw new PlanVerificationError(
      `Approved plan comment #${commentId} was not found on issue #${issueNumber}.`,
    );
  }
  if (!response.ok) {
    throw new PlanVerificationError(
      `GitHub API failed fetching comment #${commentId} (${response.status}).`,
    );
  }

  const payload = await response.json();
  if (
    !isRecord(payload) ||
    typeof payload.issue_url !== 'string' ||
    payload.issue_url.trim() === ''
  ) {
    throw new PlanVerificationError(
      `GitHub API comment #${commentId} payload is missing a valid issue_url.`,
    );
  }
  return payload;
}

/**
 * Prunes disallowed MCP tools from `.gemini/settings.json` so existing `@v0`
 * consumers automatically receive least-privilege tool scoping.
 *
 * @param {string} workspaceRoot
 */
export function sanitizePlanExecuteSettingsFile(workspaceRoot) {
  const settingsPath = resolve(workspaceRoot, DEFAULT_SETTINGS_PATH);
  if (!existsSync(settingsPath)) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new PlanVerificationError(
      `Failed to parse ${DEFAULT_SETTINGS_PATH}: ${detail}`,
    );
  }
  if (!isRecord(parsed)) {
    throw new PlanVerificationError(
      `Invalid ${DEFAULT_SETTINGS_PATH}: expected a JSON object.`,
    );
  }
  if (parsed.mcpServers === undefined) {
    return;
  }
  if (!isRecord(parsed.mcpServers)) {
    throw new PlanVerificationError(
      `Invalid ${DEFAULT_SETTINGS_PATH}: expected "mcpServers" to be an object.`,
    );
  }

  const disallowed = new Set(DISALLOWED_PLAN_EXECUTE_MCP_TOOLS);
  let mutated = false;
  for (const server of Object.values(parsed.mcpServers)) {
    if (!isRecord(server)) {
      continue;
    }
    if (Array.isArray(server.includeTools)) {
      server.includeTools = server.includeTools.filter((tool) => {
        if (typeof tool !== 'string') {
          return false;
        }
        const baseName = tool.split('(')[0].trim();
        return baseName !== '' && !disallowed.has(baseName);
      });
    }
    const existingExclude = Array.isArray(server.excludeTools)
      ? server.excludeTools.filter((tool) => typeof tool === 'string')
      : [];
    server.excludeTools = Array.from(
      new Set([...existingExclude, ...DISALLOWED_PLAN_EXECUTE_MCP_TOOLS]),
    );
    mutated = true;
  }

  if (mutated) {
    writeFileSync(settingsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  }
}

/**
 * Ensures `.geminiignore` negates `.gemini/context.json` and
 * `.gemini/approved_plan.json` when `.gitignore` ignores `.gemini/`.
 *
 * @param {string} workspaceRoot
 */
export function ensureGeminiIgnoreAllowsContextFiles(workspaceRoot) {
  const geminiIgnorePath = resolve(workspaceRoot, '.geminiignore');
  const fileExistedBefore = existsSync(geminiIgnorePath);
  const existing = fileExistedBefore
    ? readFileSync(geminiIgnorePath, 'utf8')
    : '';

  const nonEmptyLines = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tail = nonEmptyLines.slice(-GEMINI_IGNORE_STANZA.length);
  const alreadyEndsWithStanza =
    tail.length === GEMINI_IGNORE_STANZA.length &&
    tail.every((line, idx) => line === GEMINI_IGNORE_STANZA[idx]);

  if (!alreadyEndsWithStanza) {
    const prefix =
      existing.length > 0 && !existing.endsWith('\n')
        ? `${existing}\n`
        : existing;
    writeFileSync(
      geminiIgnorePath,
      `${prefix}${GEMINI_IGNORE_STANZA.join('\n')}\n`,
      'utf8',
    );
  }

  if (!fileExistedBefore && existsSync(resolve(workspaceRoot, '.git'))) {
    const gitInfoDir = resolve(workspaceRoot, '.git/info');
    if (
      existsSync(gitInfoDir) ||
      existsSync(resolve(workspaceRoot, '.git/HEAD'))
    ) {
      mkdirSync(gitInfoDir, { recursive: true });
      const excludePath = resolve(gitInfoDir, 'exclude');
      const current = existsSync(excludePath)
        ? readFileSync(excludePath, 'utf8')
        : '';
      const lines = current.split(/\r?\n/).map((line) => line.trim());
      if (
        !lines.includes('/.geminiignore') &&
        !lines.includes('.geminiignore')
      ) {
        const excludePrefix =
          current.length > 0 && !current.endsWith('\n')
            ? `${current}\n`
            : current;
        writeFileSync(excludePath, `${excludePrefix}/.geminiignore\n`, 'utf8');
      }
    }
  }
}

/**
 * Prepares `.gemini/context.json` from legacy workflow `env:` variables for
 * existing `@v0` `gemini-invoke` consumers and ensures `.geminiignore` allows
 * `.gemini/context.json` whenever present.
 *
 * @param {{
 *   workspaceRoot?: string;
 *   env?: NodeJS.ProcessEnv;
 * }} [options]
 */
export function prepareContextAndGeminiIgnore({
  workspaceRoot = process.cwd(),
  env = process.env,
} = {}) {
  const contextPath = resolve(workspaceRoot, DEFAULT_CONTEXT_PATH);
  const isInvoke =
    env.WORKFLOW_NAME === 'gemini-invoke' ||
    /^\s*\/gemini-invoke(?:\s|$)/.test(env.PROMPT_INPUT ?? '');

  if (
    !existsSync(contextPath) &&
    isInvoke &&
    (env.REPOSITORY || env.ISSUE_NUMBER || env.TITLE || env.DESCRIPTION)
  ) {
    mkdirSync(dirname(contextPath), { recursive: true });
    writeFileSync(
      contextPath,
      `${JSON.stringify(
        {
          title: env.TITLE ?? '',
          description: env.DESCRIPTION ?? '',
          event_name: env.EVENT_NAME ?? '',
          is_pull_request: env.IS_PULL_REQUEST ?? '',
          issue_number: env.ISSUE_NUMBER ?? '',
          repository: env.REPOSITORY ?? '',
          additional_context: env.ADDITIONAL_CONTEXT ?? '',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  if (existsSync(contextPath)) {
    ensureGeminiIgnoreAllowsContextFiles(workspaceRoot);
  }
}

/**
 * @param {{
 *   expectedPlanAuthor: string;
 *   apiBaseUrl: string;
 *   githubToken: string;
 *   fetchImpl: typeof fetch;
 * }} params
 */
async function resolveDynamicAuthorPolicy({
  expectedPlanAuthor,
  apiBaseUrl,
  githubToken,
  fetchImpl,
}) {
  const trimmed = expectedPlanAuthor.trim();
  if (trimmed !== '') {
    return {
      trustedAuthors: resolveTrustedPlanAuthors(trimmed),
      allowInstalledGithubAppBots: false,
    };
  }

  const trustedAuthors = new Set([DEFAULT_BOT_LOGIN.toLowerCase()]);
  try {
    const res = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/user`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (res.ok) {
      const userObj = await res.json();
      if (
        isRecord(userObj) &&
        typeof userObj.login === 'string' &&
        userObj.login
      ) {
        trustedAuthors.add(userObj.login.toLowerCase());
      }
      return { trustedAuthors, allowInstalledGithubAppBots: false };
    }
  } catch {
    // Installation tokens reject /user with 403; fall back to installed App bot check
  }
  return { trustedAuthors, allowInstalledGithubAppBots: true };
}

/**
 * @param {{
 *   workspaceRoot?: string;
 *   eventName?: string;
 *   eventPath?: string;
 *   repository?: string;
 *   apiBaseUrl?: string;
 *   githubToken?: string;
 *   expectedPlanAuthor?: string;
 *   fetchImpl?: typeof fetch;
 * }} [options]
 * @returns {Promise<VerifiedPlanRecord>}
 */
export async function verifyAndWriteApprovedPlan({
  workspaceRoot = process.cwd(),
  eventName = process.env.GITHUB_EVENT_NAME ?? '',
  eventPath = process.env.GITHUB_EVENT_PATH ?? '',
  repository = process.env.GITHUB_REPOSITORY ?? '',
  apiBaseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com',
  githubToken = process.env.GITHUB_TOKEN ?? '',
  expectedPlanAuthor = process.env.EXPECTED_PLAN_AUTHOR ?? '',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!eventPath || !existsSync(eventPath)) {
    throw new PlanVerificationError(
      'GITHUB_EVENT_PATH is missing or unreadable; cannot verify plan approval.',
    );
  }

  let eventPayload;
  try {
    eventPayload = JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new PlanVerificationError(
      `Failed to parse GITHUB_EVENT_PATH JSON: ${detail}`,
    );
  }

  const approvalContext = extractApprovalContext(eventName, eventPayload);
  if (
    repository &&
    approvalContext.repository &&
    repository.toLowerCase() !== approvalContext.repository.toLowerCase()
  ) {
    throw new PlanVerificationError(
      `Repository "${repository}" does not match event payload repository "${approvalContext.repository}".`,
    );
  }

  const targetRepo = repository || approvalContext.repository;
  if (!targetRepo || !REPOSITORY_SLUG_PATTERN.test(targetRepo)) {
    throw new PlanVerificationError(
      `Unable to determine valid target GitHub repository ("${targetRepo}").`,
    );
  }

  if (approvalContext.directive.targetCommentId === null) {
    throw new PlanVerificationError(
      'Approval must bind to a specific plan comment ID or URL (for example, "@gemini-cli /approve <comment-url-or-id>"). Bare "@gemini-cli /approve" is rejected to prevent TOCTOU plan substitution.',
    );
  }

  if (!githubToken) {
    throw new PlanVerificationError(
      'GITHUB_TOKEN is required to verify the approved plan.',
    );
  }

  const authorPolicy = await resolveDynamicAuthorPolicy({
    expectedPlanAuthor,
    apiBaseUrl,
    githubToken,
    fetchImpl,
  });

  const comment = await fetchIssueCommentById({
    apiBaseUrl,
    repository: targetRepo,
    commentId: approvalContext.directive.targetCommentId,
    issueNumber: approvalContext.issueNumber,
    githubToken,
    fetchImpl,
  });

  const verifiedPlan = selectVerifiedPlan(
    comment,
    approvalContext,
    authorPolicy.trustedAuthors,
    {
      allowInstalledGithubAppBots: authorPolicy.allowInstalledGithubAppBots,
      targetRepository: targetRepo,
    },
  );

  const approvedPlanPath = resolve(workspaceRoot, DEFAULT_APPROVED_PLAN_PATH);
  mkdirSync(dirname(approvedPlanPath), { recursive: true });
  writeFileSync(
    approvedPlanPath,
    `${JSON.stringify(verifiedPlan, null, 2)}\n`,
    'utf8',
  );

  const routingContext = {
    event_name: approvalContext.eventName,
    is_pull_request: String(approvalContext.isPullRequest),
    issue_number: String(approvalContext.issueNumber),
    repository: targetRepo,
  };
  writeFileSync(
    resolve(workspaceRoot, DEFAULT_CONTEXT_PATH),
    `${JSON.stringify(routingContext, null, 2)}\n`,
    'utf8',
  );

  sanitizePlanExecuteSettingsFile(workspaceRoot);
  ensureGeminiIgnoreAllowsContextFiles(workspaceRoot);
  return verifiedPlan;
}

/** @returns {boolean} */
function isExecutedAsMainScript() {
  if (!process.argv[1]) {
    return false;
  }
  const modulePath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(process.argv[1]) === realpathSync(modulePath);
  } catch {
    return resolve(process.argv[1]) === resolve(modulePath);
  }
}

if (isExecutedAsMainScript()) {
  if (process.argv.includes('--ensure-geminiignore')) {
    prepareContextAndGeminiIgnore();
  } else {
    verifyAndWriteApprovedPlan()
      .then((verified) => {
        console.log(
          `Verified approved plan comment #${verified.comment_id} by ${verified.author_login} (sha256: ${verified.sha256.slice(0, 12)}).`,
        );
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        const escaped = message
          .replace(/%/g, '%25')
          .replace(/\r/g, '%0D')
          .replace(/\n/g, '%0A');
        console.error(`::error title=Plan verification failed::${escaped}`);
        process.exit(1);
      });
  }
}
