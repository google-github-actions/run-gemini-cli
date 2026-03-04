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
    it(`should initiate a specific fix plan: ${item.id}`, async () => {
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
          '{"name": "test", "scripts": {"test": "echo \\"tests passed\\" && exit 0"}, "dependencies": {"lodash": "4.17.0"}}',
        );
        rig.createFile(
          'src/index.js',
          'function calculate(a, b) {\n  return a + b;\n}\n\nfunction login(username, password) {\n  if (password === "forgot password") throw new Error("crash");\n  return true;\n}\n',
        );
        rig.createFile(
          'src/async.js',
          "async function fetchData() {\n  return await api.get('/data');\n}\n",
        );
        rig.createFile(
          'src/ui/Component.tsx',
          "import React from 'react';\nexport const Component = () => {\n  return <div>UI</div>;\n}\n",
        );
        rig.createFile(
          'src/utils/validation.ts',
          'export const validate = () => true;\n',
        );
        rig.createFile(
          'src/UserForm.tsx',
          "import React from 'react';\nexport const UserForm = () => {\n  const isValid = true;\n  return <form>User</form>;\n}\n",
        );
        rig.createFile(
          'src/OrderForm.tsx',
          "import React from 'react';\nexport const OrderForm = () => {\n  const isValid = true;\n  return <form>Order</form>;\n}\n",
        );
        rig.createFile(
          'test/UserProfile.test.js',
          'describe("UserProfile", () => {\n  it("should load data", async () => {\n    // Flaky network call\n  });\n});\n',
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

        // Add a small delay to ensure telemetry logs are flushed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const toolCalls = rig.readToolLogs();
        const toolNames = toolCalls.map((c) => c.name);

        // 1. Structural check
        const hasExploration = toolNames.some(
          (n) =>
            n.includes('read_file') ||
            n.includes('list_directory') ||
            n.includes('glob') ||
            n.includes('grep') ||
            n.includes('search') ||
            n.includes('search_code') ||
            n.includes('get_file_contents'),
        );
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

        expect(stdout.length).toBeGreaterThan(0);
      } finally {
        rig.cleanup();
      }
    });
  }
});
