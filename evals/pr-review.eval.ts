import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
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

describe('PR Review Workflow', () => {
  for (const item of dataset) {
    it.concurrent(
      `should initiate review and find key issues: ${item.id}`,
      async () => {
        const rig = new TestRig(`review-${item.id}`);
        try {
          rig.setupMockMcp();
          mkdirSync(join(rig.testDir, '.gemini/commands'), { recursive: true });
          copyFileSync(
            '.github/commands/gemini-review.toml',
            join(rig.testDir, '.gemini/commands/gemini-review.toml'),
          );

          const stdout = await rig.run(
            ['--prompt', '/gemini-review', '--yolo'],
            item.inputs,
          );

          const toolCalls = rig.readToolLogs();
          const toolNames = toolCalls.map((c) => c.name);

          // 1. Structural check (tools)
          const hasSpecificReviewTool =
            toolNames.some((n) => n.includes('add_comment_to_pending_review')) ||
            toolNames.some((n) => n.includes('pull_request_review_write')) ||
            toolNames.some((n) => n.includes('submit_pending_pull_request_review')) ||
            toolCalls.some(
              (c) =>
                c.name === 'run_shell_command' &&
                c.args.includes('gh pr review'),
            );

          const hasGithubExt =
            toolNames.some((n) => n.includes('get_diff')) ||
            toolNames.some((n) => n.includes('get_files'));
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

          if (foundKeywords.length === 0) {
            console.warn(
              `Reviewer for ${item.id} didn't mention any expected findings. Output preview: ${stdout.substring(0, 200)}`,
            );
          }

          expect(foundKeywords.length).toBeGreaterThan(0);
        } finally {
          rig.cleanup();
        }
      },
    );
  }
});
