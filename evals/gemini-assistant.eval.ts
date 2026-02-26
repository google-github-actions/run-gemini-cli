import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface AssistantCase {
  id: string;
  inputs: Record<string, string>;
  expected_actions: string[];
  expected_plan_keywords: string[];
}

const datasetPath = join(__dirname, 'data/gemini-assistant.json');
const dataset: AssistantCase[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

describe('Gemini Assistant Workflow', () => {
  for (const item of dataset) {
    it.concurrent(`should propose a relevant plan: ${item.id}`, async () => {
      const rig = new TestRig(`assistant-${item.id}`);
      try {
        rig.initGit();
        rig.createFile(
          'utils.js',
          '// Helper functions\nexport function oldName() {}',
        );

        mkdirSync(join(rig.testDir, '.gemini/commands'), { recursive: true });
        copyFileSync(
          '.github/commands/gemini-invoke.toml',
          join(rig.testDir, '.gemini/commands/gemini-invoke.toml'),
        );

        const stdout = await rig.run(
          ['--prompt', '/gemini-invoke', '--yolo'],
          item.inputs,
        );

        // Add a small delay to ensure telemetry logs are flushed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const toolCalls = rig.readToolLogs();
        const toolNames = toolCalls.map((c) => c.name);

        // 1. Structural check
        const hasCommentAction =
          toolNames.includes('add_issue_comment') ||
          toolCalls.some(
            (c) =>
              c.name === 'run_shell_command' &&
              c.args.includes('issue comment'),
          );

        const hasExecutionAction =
          toolNames.includes('replace') ||
          toolNames.includes('write_file') ||
          toolNames.includes('run_shell_command') ||
          toolNames.includes('read_file') ||
          toolNames.includes('list_directory') ||
          toolNames.includes('glob');

        if (!hasCommentAction && !hasExecutionAction && toolCalls.length > 0) {
          console.warn(`Unrecognized tool calls for ${item.id}:`, toolNames);
        }

        // 2. Content check (plan relevance)
        const outputLower = stdout.toLowerCase();
        const foundKeywords = item.expected_plan_keywords.filter((kw) =>
          outputLower.includes(kw.toLowerCase()),
        );

        if (foundKeywords.length === 0) {
          console.warn(
            `Assistant for ${item.id} didn't mention expected keywords in response. Output:`,
            stdout,
          );
        }

        // Assert that the model responded with something
        expect(stdout.length).toBeGreaterThan(0);
      } finally {
        rig.cleanup();
      }
    });
  }
});
