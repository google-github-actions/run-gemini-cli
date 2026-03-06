## Description

This PR implements the necessary infrastructure in the \`run-gemini-cli\` GitHub Action to support the Gemini CLI usage metrics (P0 requirements).

It aligns with the core CLI telemetry changes introduced in [google-gemini/gemini-cli#21129](https://github.com/google-gemini/gemini-cli/pull/21129).

### Changes Made:

- **Precise Telemetry Tracking:** Introduced a new \`github_item_number\` input to \`action.yml\`. This defaults to the current Issue or PR number but allows explicit overrides. This resolves the inability to track unique items across different workflow types (e.g., scheduled vs. automated).
- **Installation Telemetry:** Added \`GH_WORKFLOW_NAME\` and \`GH_EVENT_NUMBER\` to the \`Install Gemini CLI\` step to ensure extension installations are properly tracked.
- **OTEL Collector Enhancement:** Added \`github.event.number\` to the \`scripts/collector-gcp.yaml.template\` resource attributes, ensuring Google Cloud Logging metrics are fully synchronized with Clearcut.
- **Example Workflow Updates:** Modified the \`gemini-scheduled-triage.yml\` example to correctly extract and pass a comma-separated list of issue IDs to the \`github_item_number\` input. This prevents telemetry corruption during batch processing.

### Example Telemetry Scenarios

Because the CLI appends the \`GH_EVENT_NUMBER\` and \`GH_WORKFLOW_NAME\` to the \`baseMetadata\` of all events (API Request, Response, Error), downstream analytics can perfectly distinguish and count unique issues vs. PRs based on the workflow context.

#### Scenario A: Automated PR Review

When PR #42 triggers the \`gemini-review\` workflow, the CLI logs:
\`\`\`json
{
\"event_name\": \"api_request\",
\"event_metadata\": [
[
{ \"gemini_cli_key\": 130, \"value\": \"gemini-review\" },
{ \"gemini_cli_key\": 172, \"value\": \"pull_request\" },
{ \"gemini_cli_key\": 173, \"value\": \"42\" } // GH_EVENT_NUMBER
]
]
}
\`\`\`
_Analysts can count \`DISTINCT gh_event_number WHERE gh_workflow_name LIKE '%review%'\` to satisfy the P0 PR metric._

#### Scenario B: Automated Issue Triage

When Issue #88 triggers the \`gemini-triage\` workflow, the CLI logs:
\`\`\`json
{
\"event_name\": \"api_request\",
\"event_metadata\": [
[
{ \"gemini_cli_key\": 130, \"value\": \"gemini-triage\" },
{ \"gemini_cli_key\": 172, \"value\": \"issues\" },
{ \"gemini_cli_key\": 173, \"value\": \"88\" } // GH_EVENT_NUMBER
]
]
}
\`\`\`
_Analysts can count \`DISTINCT gh_event_number WHERE gh_workflow_name LIKE '%triage%' AND gh_event_name = 'issues'\` to satisfy the P0 Automated Issue metric._

#### Scenario C: Scheduled Batch Triage

When a cron job runs and triages 3 issues (IDs 101, 102, 103) in a single CLI invocation, the CLI logs:
\`\`\`json
{
\"event_name\": \"api_request\",
\"event_metadata\": [
[
{ \"gemini_cli_key\": 130, \"value\": \"gemini-scheduled-triage\" },
{ \"gemini_cli_key\": 172, \"value\": \"schedule\" },
{ \"gemini_cli_key\": 173, \"value\": \"101,102,103\" } // GH_EVENT_NUMBER
]
]
}
\`\`\`
_Analysts can split the \`gh_event_number\` string by commas to count exactly 3 unique issues processed during a scheduled invocation._

## Related Issues

- Fixes P0 metrics requirements for GitHub Action usage.
- Depends on [google-gemini/gemini-cli#21129](https://github.com/google-gemini/gemini-cli/pull/21129)
