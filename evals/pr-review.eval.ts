import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

interface ReviewCase {
  id: string;
  inputs: Record<string, string>;
  expected_tools: string[];
  expected_findings: string[];
}

const datasetPath = join(__dirname, 'data/pr-review.json');
const dataset: ReviewCase[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));
const REVIEW_TOML_URL =
  'https://raw.githubusercontent.com/gemini-cli-extensions/code-review/main/commands/code-review.toml';

describe('PR Review Workflow', () => {
  for (const item of dataset) {
    it(`should initiate review and find key issues: ${item.id}`, async () => {
      const rig = new TestRig(`review-${item.id}`);
      try {
        rig.setupMockMcp();
        const commandDir = join(rig.testDir, '.gemini/commands');
        mkdirSync(commandDir, { recursive: true });

        const response = await fetch(REVIEW_TOML_URL);
        if (!response.ok)
          throw new Error(`Failed to fetch TOML: ${response.statusText}`);
        let tomlContent = await response.text();
        
        // Modify prompt to use MCP tools instead of git diff which fails in clean test dir
        tomlContent = tomlContent.replace(
          'call the `git diff -U5 --merge-base origin/HEAD` tool',
          'call the `pull_request_read.get_diff` tool with the provided `PULL_REQUEST_NUMBER`',
        );
        
        // Create mock skill file
        const skillDir = join(rig.testDir, '.gemini/skills/code-review-commons');
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(
          join(skillDir, 'SKILL.md'),
          `---
name: code-review-commons
description: Common code review guidelines
---
You are an expert code reviewer. Follow these rules:
1. Look for subtle race conditions in async code (e.g., returning results before assignment in .then()).
2. Identify architectural violations (e.g., UI importing DB internal logic).
`
        );
        
        writeFileSync(join(commandDir, 'pr-code-review.toml'), tomlContent);

        const stdout = await rig.run(
          ['--prompt', '/pr-code-review', '--yolo'],
          item.inputs,
          [
            'pull_request_read.get_diff', 
            'pull_request_read:get_diff',
            'activate_skill',
            'list_directory'
          ],
        );

        // Add a small delay to ensure telemetry logs are flushed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const toolCalls = rig.readToolLogs();
        const toolNames = toolCalls.map((c) => c.name);

        // 1. Structural check (tools)
        // We use .includes because MCP tools are prefixed (e.g. github__add_comment_to_pending_review)
        const hasSpecificReviewTool =
          toolNames.some(
            (n) =>
              n.includes('add_comment_to_pending_review') ||
              n.includes('pull_request_review_write') ||
              n.includes('submit_pending_pull_request_review'),
          ) ||
          toolCalls.some(
            (c) =>
              c.name === 'run_shell_command' && c.args.includes('gh pr review'),
          );

        const hasGithubExt = toolNames.some(
          (n) => n.includes('get_diff') || n.includes('get_files'),
        );
        const hasExploration =
          toolNames.includes('read_file') ||
          toolNames.includes('list_directory') ||
          toolNames.includes('glob');

        expect(hasSpecificReviewTool || hasGithubExt || hasExploration).toBe(
          true,
        );

        // 2. Content check (findings)
        // We check if the model mentions the keywords in its output/responses or tool arguments
        const toolArgs = toolCalls
          .map((tc) => JSON.stringify(tc.args))
          .join(' ')
          .toLowerCase();
        const outputLower = (stdout + ' ' + toolArgs).toLowerCase();
        const foundKeywords = item.expected_findings.filter((kw) =>
          outputLower.includes(kw.toLowerCase()),
        );

        if (foundKeywords.length === 0 && item.expected_findings.length > 0) {
          console.warn(
            `Reviewer for ${item.id} didn't mention any expected findings. Output preview: ${stdout.substring(0, 200)}`,
          );
        }

        expect(stdout.length).toBeGreaterThan(0);
        
        if (item.expected_findings.length > 0) {
          expect(foundKeywords.length).toBeGreaterThan(0);
        }
      } finally {
        rig.cleanup();
      }
    });
  }
});
