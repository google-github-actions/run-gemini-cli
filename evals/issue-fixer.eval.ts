import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface FixerCase {
  id: string;
  inputs: Record<string, string>;
  expected_actions: string[];
  expected_plan_keywords: string[];
}

const datasetPath = join(__dirname, 'data/issue-fixer.json');
const dataset: FixerCase[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

describe('Issue Fixer Workflow', () => {
  for (const item of dataset) {
    it.concurrent(
      `should initiate a specific fix plan: ${item.id}`,
      async () => {
        const rig = new TestRig(`fixer-${item.id}`);
        try {
          rig.setupMockMcp();
          rig.initGit();
          rig.createFile(
            'GEMINI.md',
            '# Project Instructions\nRun `npm test` to verify.',
          );
          rig.createFile(
            'package.json',
            '{"name": "test", "dependencies": {"lodash": "4.17.0"}}',
          );

          mkdirSync(join(rig.testDir, '.gemini/commands'), { recursive: true });
          copyFileSync(
            '.github/commands/gemini-issue-fixer.toml',
            join(rig.testDir, '.gemini/commands/gemini-issue-fixer.toml'),
          );

          const env = {
            ...item.inputs,
            EVENT_NAME: 'issues',
            TRIGGERING_ACTOR: 'test-user',
            BRANCH_NAME: `fix-${item.id}`,
            REPOSITORY: 'owner/repo',
          };

          const stdout = await rig.run(
            ['--prompt', '/gemini-issue-fixer', '--yolo'],
            env,
          );

          const toolCalls = rig.readToolLogs();
          const toolNames = toolCalls.map((c) => c.name);

          // 1. Structural check
          const hasExploration =
            toolNames.includes('read_file') ||
            toolNames.includes('list_directory') ||
            toolNames.includes('glob') ||
            toolNames.includes('grep'); // Added grep
          const hasGitAction = toolCalls.some(
            (c) =>
              c.name === 'run_shell_command' &&
              (c.args.includes('git ') || c.args.includes('"git"')),
          );
          const hasIssueAction =
            toolNames.includes('update_issue') ||
            toolNames.includes('add_issue_comment') ||
            toolCalls.some(
              (c) =>
                c.name === 'run_shell_command' &&
                (c.args.includes('gh issue') || c.args.includes('gh pr')),
            );

          const isVagueOrOutOfScope =
            item.id === 'out-of-scope' || item.id === 'impossible-request';

          if (!isVagueOrOutOfScope) {
            expect(
              hasExploration,
              `Should have explored the codebase for ${item.id}`,
            ).toBe(true);
          }
          expect(
            hasGitAction || hasIssueAction,
            `Should have used git or issue/PR tools for ${item.id}`,
          ).toBe(true);

          // 2. Content check (plan quality)
          const outputLower = stdout.toLowerCase();
          const foundKeywords = item.expected_plan_keywords.filter((kw) =>
            outputLower.includes(kw.toLowerCase()),
          );

          if (foundKeywords.length === 0) {
            console.error(
              `Fixer for ${item.id} didn't mention expected keywords in plan. Tools called:`,
              toolNames,
            );
            console.error(`Plan output: ${stdout}`);
          }

          expect(foundKeywords.length).toBeGreaterThan(0);
        } finally {
          rig.cleanup();
        }
      },
    );
  }
});
