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
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PLAN_HEADING_MARKER = 'AI Assistant: Plan of Action';
export const APPROVAL_COMMAND_PREFIX = '@gemini-cli /approve';
export const DEFAULT_BOT_LOGIN = 'github-actions[bot]';
export const DEFAULT_APPROVED_PLAN_PATH = '.gemini/approved_plan.json';
export const DEFAULT_CONTEXT_PATH = '.gemini/context.json';
export const DEFAULT_SETTINGS_PATH = '.gemini/settings.json';
export const MIN_SHA256_PREFIX_LENGTH = 7;

export const DISALLOWED_PLAN_EXECUTE_MCP_TOOLS = Object.freeze([
  'push_files',
  'delete_file',
  'fork_repository',
  'issue_read',
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
const REPOSITORY_SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FULL_COMMENT_URL_PATTERN =
  /^https?:\/\/[^/\s#]+\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/(?:issues|pull)\/(\d+)#issuecomment-(\d+)$/i;
const SHORT_COMMENT_ID_PATTERN =
  /^(?:#?issuecomment-(\d+)|comment-(\d+)|(\d+))$/i;
const SHA256_TOKEN_PATTERN = /^sha256:([a-f0-9]+)$/i;

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
 *   targetSha256Prefix: string | null;
 *   urlRepository: string | null;
 *   urlIssueNumber: number | null;
 *   additionalContext: string;
 * }} ApprovalDirective
 */

/**
 * @param {string} token
 * @param {{ targetCommentId: number | null; targetSha256Prefix: string | null; urlRepository: string | null; urlIssueNumber: number | null }} state
 * @returns {boolean}
 */
function parseCommentTargetToken(token, state) {
  if (/^https?:\/\//i.test(token) || token.includes('#issuecomment-')) {
    const urlMatch = token.match(FULL_COMMENT_URL_PATTERN);
    if (urlMatch) {
      if (state.targetCommentId !== null) {
        throw new PlanVerificationError(
          'Duplicate plan comment ID tokens in approval command.',
        );
      }
      state.urlRepository = urlMatch[1];
      state.urlIssueNumber = parsePositiveSafeInt(
        urlMatch[2],
        'URL issue number',
      );
      state.targetCommentId = parsePositiveSafeInt(urlMatch[3], 'comment ID');
      return true;
    }
    if (/^https?:\/\//i.test(token)) {
      throw new PlanVerificationError(
        `Invalid GitHub issue/PR comment URL in approval command: ${token}`,
      );
    }
  }

  const shortMatch = token.match(SHORT_COMMENT_ID_PATTERN);
  if (!shortMatch) {
    return false;
  }
  if (state.targetCommentId !== null) {
    throw new PlanVerificationError(
      'Duplicate plan comment ID tokens in approval command.',
    );
  }
  const rawId = shortMatch[1] ?? shortMatch[2] ?? shortMatch[3];
  state.targetCommentId = parsePositiveSafeInt(rawId, 'comment ID');
  return true;
}

/**
 * @param {string} token
 * @param {{ targetCommentId: number | null; targetSha256Prefix: string | null; urlRepository: string | null; urlIssueNumber: number | null }} state
 * @returns {boolean}
 */
function parseBindingToken(token, state) {
  if (parseCommentTargetToken(token, state)) {
    return true;
  }

  const shaMatch = token.match(SHA256_TOKEN_PATTERN);
  if (!shaMatch) {
    return false;
  }
  if (state.targetSha256Prefix !== null) {
    throw new PlanVerificationError(
      'Duplicate sha256 tokens in approval command.',
    );
  }
  const prefix = shaMatch[1].toLowerCase();
  if (prefix.length < MIN_SHA256_PREFIX_LENGTH) {
    throw new PlanVerificationError(
      `Plan sha256 prefix must be at least ${MIN_SHA256_PREFIX_LENGTH} hex characters.`,
    );
  }
  state.targetSha256Prefix = prefix;
  return true;
}

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
  /** @type {{ targetCommentId: number | null; targetSha256Prefix: string | null; urlRepository: string | null; urlIssueNumber: number | null }} */
  const state = {
    targetCommentId: null,
    targetSha256Prefix: null,
    urlRepository: null,
    urlIssueNumber: null,
  };
  let consumed = 0;

  while (
    consumed < tokens.length &&
    parseBindingToken(tokens[consumed], state)
  ) {
    consumed += 1;
  }

  // Reject duplicate comment-ID or sha256 tokens appearing after free-form text
  for (const trailing of tokens.slice(consumed)) {
    if (
      SHORT_COMMENT_ID_PATTERN.test(trailing) ||
      FULL_COMMENT_URL_PATTERN.test(trailing) ||
      SHA256_TOKEN_PATTERN.test(trailing)
    ) {
      parseBindingToken(trailing, state);
    }
  }

  return {
    targetCommentId: state.targetCommentId,
    targetSha256Prefix: state.targetSha256Prefix,
    urlRepository: state.urlRepository,
    urlIssueNumber: state.urlIssueNumber,
    additionalContext: tokens.slice(consumed).join(' '),
  };
}

/**
 * @param {string} eventName
 * @param {Record<string, unknown>} eventPayload
 */
function resolveEventTriggerSource(eventName, eventPayload) {
  const action = eventPayload.action;
  if (eventName === 'pull_request_review' && isRecord(eventPayload.review)) {
    if (action !== 'submitted') {
      throw new PlanVerificationError(
        `Unsupported pull_request_review action "${String(action)}"; expected "submitted".`,
      );
    }
    return { source: eventPayload.review, sharesIssueCommentIdSpace: false };
  }
  if (
    (eventName === 'issue_comment' ||
      eventName === 'pull_request_review_comment') &&
    isRecord(eventPayload.comment)
  ) {
    if (action !== 'created') {
      throw new PlanVerificationError(
        `Unsupported ${eventName} action "${String(action)}"; expected "created".`,
      );
    }
    return {
      source: eventPayload.comment,
      sharesIssueCommentIdSpace: eventName === 'issue_comment',
    };
  }
  throw new PlanVerificationError(
    `Unsupported approval event payload for event "${eventName}".`,
  );
}

/**
 * @typedef {{
 *   eventName: string;
 *   isPullRequest: boolean;
 *   issueNumber: number;
 *   repository: string;
 *   approvalId: number | null;
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

  const { source, sharesIssueCommentIdSpace } = resolveEventTriggerSource(
    eventName,
    eventPayload,
  );
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
  const isPullRequest = hasTopLevelPr || hasIssuePr;
  const issueObj = hasTopLevelPr
    ? eventPayload.pull_request
    : eventPayload.issue;
  const issueNumber = isRecord(issueObj) ? issueObj.number : undefined;
  if (typeof issueNumber !== 'number' || !Number.isInteger(issueNumber)) {
    throw new PlanVerificationError(
      'Unable to determine target issue or PR number.',
    );
  }

  const timestampRaw = source.created_at ?? source.submitted_at;
  return {
    eventName,
    isPullRequest,
    issueNumber,
    repository: isRecord(eventPayload.repository)
      ? String(eventPayload.repository.full_name ?? '')
      : '',
    approvalId: typeof source.id === 'number' ? source.id : null,
    sharesIssueCommentIdSpace,
    approvalTimestampMs: parseTimestampMs(timestampRaw, 'approval'),
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
    return new Set([DEFAULT_BOT_LOGIN]);
  }
  const logins = normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set(logins.length > 0 ? logins : [DEFAULT_BOT_LOGIN]);
}

/**
 * @param {Record<string, unknown>} comment
 * @param {Set<string>} trustedAuthors
 * @param {boolean} allowInstalledGithubAppBots
 * @returns {string}
 */
function verifyCommentAuthor(
  comment,
  trustedAuthors,
  allowInstalledGithubAppBots,
) {
  const user = isRecord(comment.user) ? comment.user : null;
  const authorLogin = typeof user?.login === 'string' ? user.login : '';
  if (trustedAuthors.has(authorLogin)) {
    return authorLogin;
  }
  if (
    allowInstalledGithubAppBots &&
    user?.type === 'Bot' &&
    authorLogin.endsWith('[bot]') &&
    isRecord(comment.performed_via_github_app)
  ) {
    return authorLogin;
  }
  throw new PlanVerificationError(
    `Comment #${String(comment.id)} author "${authorLogin}" is not an authorized plan bot ([${Array.from(trustedAuthors).join(', ')}]).`,
  );
}

/**
 * @param {Record<string, unknown>} comment
 * @param {ApprovalContext} approvalContext
 * @param {Set<string>} trustedAuthors
 * @param {boolean} allowInstalledGithubAppBots
 * @returns {{ body: string; authorLogin: string; createdAt: string; updatedAt: string }}
 */
function verifyPlanCommentProvenanceAndTiming(
  comment,
  approvalContext,
  trustedAuthors,
  allowInstalledGithubAppBots,
) {
  if (
    typeof comment.body !== 'string' ||
    !PLAN_HEADING_REGEX.test(comment.body)
  ) {
    throw new PlanVerificationError(
      `Comment #${String(comment.id)} does not contain a Markdown heading for "${PLAN_HEADING_MARKER}".`,
    );
  }

  const authorLogin = verifyCommentAuthor(
    comment,
    trustedAuthors,
    allowInstalledGithubAppBots,
  );

  if (
    approvalContext.sharesIssueCommentIdSpace &&
    approvalContext.approvalId !== null &&
    typeof comment.id === 'number' &&
    comment.id >= approvalContext.approvalId
  ) {
    throw new PlanVerificationError(
      `Comment #${comment.id} was created after approval comment #${approvalContext.approvalId}.`,
    );
  }

  const createdAt = String(comment.created_at ?? '');
  const updatedAt = String(comment.updated_at ?? comment.created_at ?? '');
  const createdMs = parseTimestampMs(createdAt, 'plan created_at');
  const updatedMs = parseTimestampMs(updatedAt, 'plan updated_at');
  if (
    createdMs > approvalContext.approvalTimestampMs ||
    updatedMs > approvalContext.approvalTimestampMs
  ) {
    throw new PlanVerificationError(
      `Comment #${String(comment.id)} was created or modified after approval.`,
    );
  }

  if (
    updatedMs !== createdMs &&
    approvalContext.directive.targetSha256Prefix === null
  ) {
    const digestHint = computePlanSha256(comment.body).slice(0, 12);
    throw new PlanVerificationError(
      `Comment #${String(comment.id)} was edited after creation; inspect the comment and approve with explicit "sha256:${digestHint}" if intentional.`,
    );
  }

  return { body: comment.body, authorLogin, createdAt, updatedAt };
}

/**
 * @param {ApprovalDirective} directive
 * @param {string} repository
 * @param {number} issueNumber
 */
function validateCommentUrlMatchesTarget(directive, repository, issueNumber) {
  if (
    directive.urlRepository !== null &&
    repository &&
    directive.urlRepository.toLowerCase() !== repository.toLowerCase()
  ) {
    throw new PlanVerificationError(
      `Approval URL repository "${directive.urlRepository}" does not match current repository "${repository}".`,
    );
  }
  if (
    directive.urlIssueNumber !== null &&
    directive.urlIssueNumber !== issueNumber
  ) {
    throw new PlanVerificationError(
      `Approval URL issue #${directive.urlIssueNumber} does not match current issue #${issueNumber}.`,
    );
  }
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
  const { targetCommentId, targetSha256Prefix } = approvalContext.directive;
  if (targetCommentId === null) {
    throw new PlanVerificationError(
      'Approval must bind to a specific plan comment ID or URL (for example, "@gemini-cli /approve <comment-url-or-id>"). Bare "@gemini-cli /approve" is rejected to prevent TOCTOU plan substitution.',
    );
  }

  const repoForCheck = options.targetRepository ?? approvalContext.repository;
  validateCommentUrlMatchesTarget(
    approvalContext.directive,
    repoForCheck,
    approvalContext.issueNumber,
  );

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

  if (typeof target.issue_url === 'string' && repoForCheck) {
    const expectedSuffix = `/repos/${repoForCheck.toLowerCase()}/issues/${approvalContext.issueNumber}`;
    if (!target.issue_url.toLowerCase().endsWith(expectedSuffix)) {
      throw new PlanVerificationError(
        `Comment #${targetCommentId} belongs to a different issue (${target.issue_url}).`,
      );
    }
  }

  const verifiedMeta = verifyPlanCommentProvenanceAndTiming(
    target,
    approvalContext,
    trustedAuthors,
    Boolean(options.allowInstalledGithubAppBots),
  );

  const sha256 = computePlanSha256(verifiedMeta.body);
  if (targetSha256Prefix !== null && !sha256.startsWith(targetSha256Prefix)) {
    throw new PlanVerificationError(
      `Approved plan digest mismatch for comment #${targetCommentId}: expected prefix "${targetSha256Prefix}", got "${sha256.slice(0, 12)}".`,
    );
  }

  return {
    verified: true,
    comment_id: targetCommentId,
    author_login: verifiedMeta.authorLogin,
    created_at: verifiedMeta.createdAt,
    updated_at: verifiedMeta.updatedAt,
    approved_by: approvalContext.approverLogin,
    sha256,
    plan: verifiedMeta.body,
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
      `GitHub API failed fetching comment #${commentId} (${response.status} ${response.statusText}).`,
    );
  }

  const payload = await response.json();
  if (!isRecord(payload)) {
    throw new PlanVerificationError(
      'Unexpected non-object comment payload from GitHub API.',
    );
  }
  return payload;
}

/**
 * Resolves additional token author permissions when EXPECTED_PLAN_AUTHOR is unset
 * (for backward compatibility with existing @v0 workflows using Custom GitHub Apps or PATs).
 *
 * @param {{
 *   expectedPlanAuthor: string;
 *   apiBaseUrl: string;
 *   githubToken: string;
 *   fetchImpl?: typeof fetch;
 * }} params
 * @returns {Promise<{ trustedAuthors: Set<string>; allowInstalledGithubAppBots: boolean }>}
 */
async function resolveDynamicAuthorPolicy({
  expectedPlanAuthor,
  apiBaseUrl,
  githubToken,
  fetchImpl = globalThis.fetch,
}) {
  const trimmed = expectedPlanAuthor.trim();
  if (trimmed !== '') {
    return {
      trustedAuthors: resolveTrustedPlanAuthors(trimmed),
      allowInstalledGithubAppBots: false,
    };
  }

  const trustedAuthors = new Set([DEFAULT_BOT_LOGIN]);
  const userUrl = `${apiBaseUrl.replace(/\/$/, '')}/user`;
  try {
    const res = await fetchImpl(userUrl, {
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
        trustedAuthors.add(userObj.login);
      }
      return { trustedAuthors, allowInstalledGithubAppBots: false };
    }
  } catch {
    // Non-fatal probe fallback: installation tokens reject /user with 403
  }
  return { trustedAuthors, allowInstalledGithubAppBots: true };
}

/**
 * @param {ApprovalContext} approvalContext
 * @param {string} repository
 */
export function buildSanitizedRoutingContext(approvalContext, repository) {
  return {
    event_name: approvalContext.eventName,
    is_pull_request: String(approvalContext.isPullRequest),
    issue_number: String(approvalContext.issueNumber),
    repository,
  };
}

/**
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @returns {string}
 */
function assertSafeWorkspaceTarget(workspaceRoot, relativePath) {
  const realRoot = realpathSync(workspaceRoot);
  const candidate = resolve(realRoot, relativePath);
  const rel = relative(realRoot, candidate);
  if (rel.startsWith('..') || rel === '') {
    throw new PlanVerificationError(
      `Refusing to access path outside workspace: ${relativePath}`,
    );
  }

  const parentDir = dirname(candidate);
  if (existsSync(parentDir) && lstatSync(parentDir).isSymbolicLink()) {
    throw new PlanVerificationError(
      `Refusing to write inside symlinked directory: ${parentDir}`,
    );
  }
  if (existsSync(candidate) && lstatSync(candidate).isSymbolicLink()) {
    throw new PlanVerificationError(
      `Refusing to overwrite symlinked file: ${candidate}`,
    );
  }
  return candidate;
}

/**
 * @param {string} workspaceRoot
 * @param {string} relativePath
 * @param {string} content
 */
function writeSafeWorkspaceFile(workspaceRoot, relativePath, content) {
  const destination = assertSafeWorkspaceTarget(workspaceRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  rmSync(destination, { force: true });
  writeFileSync(destination, content, 'utf8');
}

/**
 * Prunes disallowed MCP tools from `.gemini/settings.json` if present so
 * existing `@v0` consumers automatically receive least-privilege tool scoping.
 *
 * @param {string} workspaceRoot
 */
export function sanitizePlanExecuteSettingsFile(workspaceRoot) {
  const settingsPath = assertSafeWorkspaceTarget(
    workspaceRoot,
    DEFAULT_SETTINGS_PATH,
  );
  if (!existsSync(settingsPath)) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    return;
  }
  if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) {
    return;
  }
  const githubServer = parsed.mcpServers.github;
  if (!isRecord(githubServer) || !Array.isArray(githubServer.includeTools)) {
    return;
  }

  const disallowed = new Set(DISALLOWED_PLAN_EXECUTE_MCP_TOOLS);
  githubServer.includeTools = githubServer.includeTools.filter(
    (tool) => typeof tool === 'string' && !disallowed.has(tool),
  );
  writeSafeWorkspaceFile(
    workspaceRoot,
    DEFAULT_SETTINGS_PATH,
    `${JSON.stringify(parsed, null, 2)}\n`,
  );
}

/**
 * Registers `/.geminiignore` in `.git/info/exclude` when creating an untracked
 * `.geminiignore` so workflows that run `git add .` never commit it.
 *
 * @param {string} workspaceRoot
 */
function excludeUntrackedGeminiIgnoreInGit(workspaceRoot) {
  const gitInfoDir = resolve(workspaceRoot, '.git', 'info');
  if (!existsSync(gitInfoDir) || lstatSync(gitInfoDir).isSymbolicLink()) {
    return;
  }
  const excludePath = resolve(gitInfoDir, 'exclude');
  if (existsSync(excludePath) && lstatSync(excludePath).isSymbolicLink()) {
    return;
  }
  const current = existsSync(excludePath)
    ? readFileSync(excludePath, 'utf8')
    : '';
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes('/.geminiignore') || lines.includes('.geminiignore')) {
    return;
  }
  const prefix =
    current.length > 0 && !current.endsWith('\n') ? `${current}\n` : current;
  writeFileSync(excludePath, `${prefix}/.geminiignore\n`, 'utf8');
}

/**
 * @param {string} workspaceRoot
 * @param {string} [approvedPlanRelPath]
 */
export function ensureGeminiIgnoreAllowsContextFiles(
  workspaceRoot,
  approvedPlanRelPath = DEFAULT_APPROVED_PLAN_PATH,
) {
  const geminiIgnorePath = assertSafeWorkspaceTarget(
    workspaceRoot,
    '.geminiignore',
  );
  const fileExistedBefore = existsSync(geminiIgnorePath);
  const existing = fileExistedBefore
    ? readFileSync(geminiIgnorePath, 'utf8')
    : '';

  const normalizedPlanPath = approvedPlanRelPath
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
  const stanza =
    normalizedPlanPath === DEFAULT_APPROVED_PLAN_PATH
      ? [...GEMINI_IGNORE_STANZA]
      : [
          '!.gemini',
          '!.gemini/',
          '.gemini/*',
          `!${DEFAULT_CONTEXT_PATH}`,
          `!${normalizedPlanPath}`,
        ];

  const nonEmptyLines = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tail = nonEmptyLines.slice(-stanza.length);
  const alreadyEndsWithStanza =
    tail.length === stanza.length &&
    tail.every((line, idx) => line === stanza[idx]);

  if (!alreadyEndsWithStanza) {
    const prefix =
      existing.length > 0 && !existing.endsWith('\n')
        ? `${existing}\n`
        : existing;
    writeSafeWorkspaceFile(
      workspaceRoot,
      '.geminiignore',
      `${prefix}${stanza.join('\n')}\n`,
    );
  }

  if (!fileExistedBefore) {
    excludeUntrackedGeminiIgnoreInGit(workspaceRoot);
  }
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
 *   approvedPlanRelPath?: string;
 *   contextRelPath?: string;
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
  approvedPlanRelPath = DEFAULT_APPROVED_PLAN_PATH,
  contextRelPath = DEFAULT_CONTEXT_PATH,
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

  validateCommentUrlMatchesTarget(
    approvalContext.directive,
    targetRepo,
    approvalContext.issueNumber,
  );

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

  writeSafeWorkspaceFile(
    workspaceRoot,
    approvedPlanRelPath,
    `${JSON.stringify(verifiedPlan, null, 2)}\n`,
  );

  const routingContext = buildSanitizedRoutingContext(
    approvalContext,
    targetRepo,
  );
  writeSafeWorkspaceFile(
    workspaceRoot,
    contextRelPath,
    `${JSON.stringify(routingContext, null, 2)}\n`,
  );

  sanitizePlanExecuteSettingsFile(workspaceRoot);
  ensureGeminiIgnoreAllowsContextFiles(workspaceRoot, approvedPlanRelPath);
  return verifiedPlan;
}

/**
 * @param {string} message
 * @returns {string}
 */
function escapeWorkflowCommandMessage(message) {
  return message
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
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

if (
  isExecutedAsMainScript() ||
  process.argv.includes('--verify') ||
  process.argv.includes('--ensure-geminiignore')
) {
  if (process.argv.includes('--ensure-geminiignore')) {
    try {
      ensureGeminiIgnoreAllowsContextFiles(process.cwd());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `::error title=Gemini ignore setup failed::${escapeWorkflowCommandMessage(message)}`,
      );
      process.exit(1);
    }
  } else {
    verifyAndWriteApprovedPlan()
      .then((verified) => {
        console.log(
          `Verified approved plan comment #${verified.comment_id} by ${verified.author_login} (sha256: ${verified.sha256.slice(0, 12)}).`,
        );
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `::error title=Plan verification failed::${escapeWorkflowCommandMessage(message)}`,
        );
        process.exit(1);
      });
  }
}
