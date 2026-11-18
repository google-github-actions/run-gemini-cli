/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureGeminiIgnoreAllowsContextFiles } from '../scripts/resolve-approved-plan.mjs';

interface ExecutionCase {
  id: string;
  inputs: Record<string, string>;
  approved_plan?: Record<string, unknown> | null;
  expected_tools: string[];
  expected_plan_keywords: string[];
}

const datasetPath = join(__dirname, 'data/gemini-plan-execute.json');
const dataset: ExecutionCase[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

describe('Gemini Plan Execution Workflow', () => {
  for (const item of dataset) {
    it.concurrent(`should execute a specific plan: ${item.id}`, async () => {
      const rig = new TestRig(`plan-execute-${item.id}`);
      try {
        rig.initGit();
        rig.setupMockMcp();

        mkdirSync(join(rig.testDir, '.gemini/commands'), { recursive: true });
        writeFileSync(
          join(rig.testDir, '.gemini/context.json'),
          JSON.stringify(
            {
              event_name: item.inputs.EVENT_NAME ?? 'issue_comment',
              is_pull_request: item.inputs.IS_PULL_REQUEST ?? 'false',
              issue_number: item.inputs.ISSUE_NUMBER ?? '10',
              repository: item.inputs.REPOSITORY ?? 'owner/repo',
            },
            null,
            2,
          ),
        );
        if (item.approved_plan) {
          writeFileSync(
            join(rig.testDir, '.gemini/approved_plan.json'),
            JSON.stringify(item.approved_plan, null, 2),
          );
        }
        ensureGeminiIgnoreAllowsContextFiles(rig.testDir);
        copyFileSync(
          '.github/commands/gemini-plan-execute.toml',
          join(rig.testDir, '.gemini/commands/gemini-plan-execute.toml'),
        );

        const stdout = await rig.run(
          ['--prompt', '/gemini-plan-execute', '--yolo'],
          item.inputs,
        );

        // Add a small delay to ensure telemetry logs are flushed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const toolCalls = rig.readToolLogs();
        const toolNames = toolCalls.map((c) => c.name);

        // 1. Structural check
        const toolNamesStripped = toolNames.map((name) =>
          name.replace(/^mcp_github_/, ''),
        );
        const hasSomeExpectedToolCalls =
          item.expected_tools.length === 0 ||
          item.expected_tools.some(
            (action) =>
              toolNamesStripped.includes(action) ||
              toolCalls.some(
                (c) =>
                  c.name === 'run_shell_command' && c.args.includes(action),
              ),
          );

        if (!hasSomeExpectedToolCalls) {
          console.error(
            `Expected some of ${item.expected_tools} but got tools:`,
            toolNames,
          );
        }
        expect(hasSomeExpectedToolCalls).toBe(true);

        if (!item.approved_plan) {
          for (const forbidden of [
            'issue_read',
            'create_branch',
            'create_or_update_file',
            'create_pull_request',
            'push_files',
            'delete_file',
          ]) {
            expect(toolNamesStripped).not.toContain(forbidden);
          }
        }

        // 2. Content check (plan relevance)
        const outputLower = stdout.toLowerCase();
        const foundKeywords = item.expected_plan_keywords.filter((kw) =>
          outputLower.includes(kw.toLowerCase()),
        );

        if (foundKeywords.length === 0) {
          console.warn(
            `Plan execution for ${item.id} didn't mention expected keywords in response. Output:`,
            stdout,
          );
        }

        expect(stdout.length).toBeGreaterThan(0);
      } finally {
        rig.cleanup();
      }
    });
  }
});
