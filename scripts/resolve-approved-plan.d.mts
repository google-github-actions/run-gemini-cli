/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const PLAN_HEADING_MARKER: string;
export const APPROVAL_COMMAND_PREFIX: string;
export const DEFAULT_BOT_LOGIN: string;
export const DEFAULT_APPROVED_PLAN_PATH: string;
export const DEFAULT_CONTEXT_PATH: string;
export const DEFAULT_SETTINGS_PATH: string;
export const MIN_SHA256_PREFIX_LENGTH: number;
export const DISALLOWED_PLAN_EXECUTE_MCP_TOOLS: readonly string[];

export class PlanVerificationError extends Error {
  constructor(message: string);
}

export interface ApprovalDirective {
  targetCommentId: number | null;
  targetSha256Prefix: string | null;
  urlRepository: string | null;
  urlIssueNumber: number | null;
  additionalContext: string;
}

export interface ApprovalContext {
  eventName: string;
  isPullRequest: boolean;
  issueNumber: number;
  repository: string;
  approvalId: number | null;
  sharesIssueCommentIdSpace: boolean;
  approvalTimestampMs: number;
  approverLogin: string;
  directive: ApprovalDirective;
}

export interface SanitizedRoutingContext {
  event_name: string;
  is_pull_request: string;
  issue_number: string;
  repository: string;
}

export interface VerifiedPlanRecord {
  verified: true;
  comment_id: number;
  author_login: string;
  created_at: string;
  updated_at: string;
  approved_by: string;
  sha256: string;
  plan: string;
}

export function computePlanSha256(planBody: string): string;
export function parseApprovalDirective(
  rawBody: unknown,
): ApprovalDirective | null;
export function extractApprovalContext(
  eventName: string,
  eventPayload: unknown,
): ApprovalContext;
export function resolveTrustedPlanAuthors(
  expectedPlanAuthor?: string,
): Set<string>;
export function selectVerifiedPlan(
  commentsOrSingle: unknown,
  approvalContext: ApprovalContext,
  trustedAuthors: Set<string>,
  options?: {
    allowInstalledGithubAppBots?: boolean;
    targetRepository?: string;
  },
): VerifiedPlanRecord;
export function buildSanitizedRoutingContext(
  approvalContext: ApprovalContext,
  repository: string,
): SanitizedRoutingContext;

export function fetchIssueCommentById(options: {
  apiBaseUrl: string;
  repository: string;
  commentId: number;
  issueNumber: number;
  githubToken: string;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>>;

export function sanitizePlanExecuteSettingsFile(workspaceRoot: string): void;
export function ensureGeminiIgnoreAllowsContextFiles(
  workspaceRoot: string,
  approvedPlanRelPath?: string,
): void;

export function verifyAndWriteApprovedPlan(options?: {
  workspaceRoot?: string;
  eventName?: string;
  eventPath?: string;
  repository?: string;
  apiBaseUrl?: string;
  githubToken?: string;
  expectedPlanAuthor?: string;
  approvedPlanRelPath?: string;
  contextRelPath?: string;
  fetchImpl?: typeof fetch;
}): Promise<VerifiedPlanRecord>;
