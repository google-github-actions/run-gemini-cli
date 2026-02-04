import { describe, expect, it } from 'vitest';
import { TestRig } from './test-rig';
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ScheduledTriageCase {
  id: string;
  inputs: Record<string, string>;
  expected: any[];
}

const datasetPath = join(__dirname, 'data/gemini-scheduled-triage.json');
const dataset: ScheduledTriageCase[] = JSON.parse(readFileSync(datasetPath, 'utf-8'));

describe('Scheduled Triage Workflow', () => {
  for (const item of dataset) {
    it.concurrent(`should batch triage issues: ${item.id}`, async () => {
      const rig = new TestRig(`scheduled-triage-${item.id}`);
      try {
        mkdirSync(join(rig.testDir, '.gemini/commands'), { recursive: true });
        copyFileSync('.github/commands/gemini-scheduled-triage.toml', join(rig.testDir, '.gemini/commands/gemini-scheduled-triage.toml'));
        
        const envFile = join(rig.testDir, 'github.env');
        const env = {
          ...item.inputs,
          GITHUB_ENV: envFile
        };

        await rig.run(['--prompt', '/gemini-scheduled-triage', '--yolo'], env);

        const content = readFileSync(envFile, 'utf-8');
        const triagedLine = content.split('\n').find(l => l.startsWith('TRIAGED_ISSUES='));
        expect(triagedLine).toBeDefined();
        
        const jsonStr = triagedLine!.split('=', 2)[1];
        const actual = JSON.parse(jsonStr);
        
        expect(actual.length).toBeGreaterThan(0);
        
        for (const exp of item.expected) {
          const found = actual.find((a: any) => a.issue_number === exp.issue_number);
          expect(found).toBeDefined();
          for (const label of exp.labels_to_set) {
            expect(found.labels_to_set).toContain(label);
          }
        }
      } finally {
        rig.cleanup();
      }
    });
  }
});