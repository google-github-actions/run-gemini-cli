import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

interface TriageCase {
  id: string;
  inputs: {
    ISSUE_TITLE: string;
    ISSUE_BODY: string;
    AVAILABLE_LABELS: string;
  };
  expected: string[];
}

const datasetPath = join(__dirname, 'data/issue-triage.json');
const dataset: TriageCase[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

describe('Issue Triage Workflow', () => {
  for (const item of dataset) {
    it.concurrent(`should correctly triage: ${item.id}`, async () => {
      const rig = new TestRig(`triage-${item.id}`);
      try {
        // Setup the command
        mkdirSync(join(rig.testDir, '.gemini/commands'), { recursive: true });
        copyFileSync('.github/commands/gemini-triage.toml', join(rig.testDir, '.gemini/commands/gemini-triage.toml'));
        
        const envFile = join(rig.testDir, 'github.env');
        const env = {
          ISSUE_TITLE: item.inputs.ISSUE_TITLE,
          ISSUE_BODY: item.inputs.ISSUE_BODY,
          AVAILABLE_LABELS: item.inputs.AVAILABLE_LABELS,
          GITHUB_ENV: envFile
        };

        await rig.run(['--prompt', '/gemini-triage', '--yolo'], env);

        // Check the output in GITHUB_ENV
        const content = readFileSync(envFile, 'utf-8');
        const labelsLine = content.split('\n').find(l => l.startsWith('SELECTED_LABELS='));
        expect(labelsLine).toBeDefined();
        
        const actualLabels = labelsLine!.split('=')[1].split(',').map(l => l.trim()).filter(l => l).sort();
        const expectedLabels = [...item.expected].sort();
        
        expect(actualLabels).toEqual(expectedLabels);
      } finally {
        rig.cleanup();
      }
    });
  }
});