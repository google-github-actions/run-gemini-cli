import { describe, expect, it, vi } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ExecutionCase {
  id: string;
  inputs: Record<string, string>;
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
        copyFileSync(
          '.github/commands/gemini-plan-execute.toml',
          join(rig.testDir, '.gemini/commands/gemini-plan-execute.toml'),
        );

        const stdout = await rig.run(
          ['--prompt', '/gemini-plan-execute', '--yolo'],
          item.inputs,
        );

        const toolCalls = rig.readToolLogs();
        const toolNames = toolCalls.map((c) => c.name);

        // 1. Structural check
        const hasSomeExpectedToolCalls =
          item.expected_tools.length === 0 ||
          item.expected_tools.some(
            (action) =>
              toolNames.includes(action) ||
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
