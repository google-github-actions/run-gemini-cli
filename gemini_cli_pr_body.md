## Summary

This PR adds new telemetry attributes to the Gemini CLI to support granular usage metrics for GitHub Actions. These metrics will allow us to track unique Issues and PRs touched by the CLI, and distinguish between different workflow triggers (e.g., Automated vs. Scheduled triage).

Will fix https://github.com/google-gemini/gemini-cli/issues/21130

## Details

- Added `GEMINI_CLI_GH_EVENT_NAME` to `EventMetadataKey`.
- Added specific tracking IDs: `GEMINI_CLI_GH_PR_NUMBER`, `GEMINI_CLI_GH_ISSUE_NUMBER`, and `GEMINI_CLI_GH_CUSTOM_TRACKING_ID` replacing generic `GH_EVENT_NUMBER`.
- Updated `ClearcutLogger` to capture these from environment variables (`GITHUB_EVENT_NAME`, `GH_PR_NUMBER`, `GH_ISSUE_NUMBER`, and `GH_CUSTOM_TRACKING_ID`).
- The PR/Issue number is logged as a raw string ID (e.g., `123`) to avoid fingerprinting PII, relying on the repository context to provide global uniqueness for backend queries.
- Updated telemetry tests in `clearcut-logger.test.ts` to cover the new environment variables and metadata keys.
- Updated telemetry documentation in `docs/cli/telemetry.md`.

### Example Telemetry Scenarios

Because the CLI appends these context fields to the `baseMetadata` of all events (API Request, Response, Error), downstream analytics can perfectly distinguish and count unique issues vs. PRs based on the workflow context.

#### Scenario A: Automated PR Review

When PR #42 triggers the `gemini-review` workflow, the CLI logs:

```json
{
  "event_name": "api_request",
  "event_metadata": [
    [
      { "gemini_cli_key": 130, "value": "gemini-review" },
      { "gemini_cli_key": 172, "value": "pull_request" },
      { "gemini_cli_key": 173, "value": "42" } // GH_PR_NUMBER
    ]
  ]
}
```

_Analysts can count `DISTINCT gh_pr_number WHERE gh_workflow_name LIKE '%review%'` to satisfy the P0 PR metric._

#### Scenario B: Automated Issue Triage

When Issue #88 triggers the `gemini-triage` workflow, the CLI logs:

```json
{
  "event_name": "api_request",
  "event_metadata": [
    [
      { "gemini_cli_key": 130, "value": "gemini-triage" },
      { "gemini_cli_key": 172, "value": "issues" },
      { "gemini_cli_key": 174, "value": "88" } // GH_ISSUE_NUMBER
    ]
  ]
}
```

_Analysts can count `DISTINCT gh_issue_number WHERE gh_workflow_name LIKE '%triage%' AND gh_event_name = 'issues'` to satisfy the P0 Automated Issue metric._

#### Scenario C: Scheduled Batch Triage

When a cron job runs and triages 3 issues (IDs 101, 102, 103) in a single CLI invocation, the CLI logs:

```json
{
  "event_name": "api_request",
  "event_metadata": [
    [
      { "gemini_cli_key": 130, "value": "gemini-scheduled-triage" },
      { "gemini_cli_key": 172, "value": "schedule" },
      { "gemini_cli_key": 175, "value": "101,102,103" } // GH_CUSTOM_TRACKING_ID
    ]
  ]
}
```

_Analysts can split the `gh_custom_tracking_id` string by commas to count exactly 3 unique issues processed during a scheduled invocation._

## Related Issues

Related to internal PM request for "Gemini CLI GitHub Action Usage Metric".

## How to Validate

1. Run the new tests: `npm test -w @google/gemini-cli-core -- src/telemetry/clearcut-logger/clearcut-logger.test.ts`
2. Verify that when `GITHUB_EVENT_NAME` and specific IDs (`GH_PR_NUMBER`, etc.) are set in the environment, they appear in the Clearcut log metadata as expected.

## Pre-Merge Checklist

- [x] Updated relevant documentation and README (if needed)
- [x] Added/updated tests (if needed)
- [ ] Noted breaking changes (if any)
- [ ] Validated on required platforms/methods:
  - [ ] MacOS
  - [ ] Windows
  - [x] Linux
