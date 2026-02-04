# Gemini CLI Workflow Evaluations

This directory contains resources for evaluating and improving the example workflows using a TypeScript + Vitest framework.

## Goals

1.  **Systematic Testing:** Ensure changes to prompts or configurations improve quality.
2.  **Regression Testing:** Catch degradations in performance.
3.  **Benchmarking:** Compare different models (e.g., `gemini-2.5-pro` vs `gemini-2.5-flash`).

## Structure

*   `evals/`:
    *   `test-rig.ts`: Utility to setup a temporary environment for the CLI.
    *   `issue-triage.eval.ts`: Benchmark for the Issue Triage workflow.
    *   `pr-review.eval.ts`: Benchmark for the PR Review workflow.
    *   `issue-fixer.eval.ts`: Benchmark for the autonomous Issue Fixer.
    *   `gemini-assistant.eval.ts`: Benchmark for the interactive Assistant.
    *   `gemini-scheduled-triage.eval.ts`: Benchmark for batch triage.
    *   `data/*.jsonl`: Gold-standard datasets for each workflow.
    *   `vitest.config.ts`: Configuration for the evaluation runner.

## How to Run

### Prerequisites

- `npm install`
- `gemini-cli` installed and available in your PATH.
- `GEMINI_API_KEY` environment variable set.

### Run Locally

```bash
npm run test:evals
```

To run against a specific model:

```bash
GEMINI_MODEL=gemini-2.5-flash npm run test:evals
```

## Adding New Evals

1. Create a new file in `evals/` ending in `.eval.ts`.
2. Add corresponding test data in `evals/data/`.
3. Use the `TestRig` to set up files, environment variables, and run the CLI.
4. Assert the expected behavior (e.g., check `GITHUB_ENV` output or tool calls captured in telemetry).