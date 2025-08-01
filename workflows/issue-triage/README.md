# Issue Triage Workflows

This document describes a comprehensive system for triaging GitHub issues using the Gemini CLI GitHub Action. This system consists of two complementary workflows: a real-time triage workflow and a scheduled triage workflow.

- [Issue Triage Workflows](#issue-triage-workflows)
  - [How it Works](#how-it-works)
  - [Implementation](#implementation)
  - [Workflows in Detail](#workflows-in-detail)
    - [Real-Time Issue Triage](#real-time-issue-triage)
    - [Scheduled Issue Triage](#scheduled-issue-triage)


## How it Works

```mermaid
graph TD
    subgraph "Triggers"
        A[Issue Opened or Reopened]
        B[Scheduled Cron Job]
        C[Manual Dispatch]
        D[Issue Comment with '@gemini-cli /triage' Created]
    end

    subgraph "Gemini CLI on GitHub"
        E[Get Issue Details]
        F{Issue needs triage?}
        G[Analyze Issue with Gemini]
        H[Apply Labels]
    end

    A --> E
    B --> E
    C --> E
    D --> E
    E --> F
    F -- Yes --> G
    G --> H
    F -- No --> J((End))
    H --> J
```

The two workflows work together to ensure that all new and existing issues are triaged in a timely manner.

1. **Real-Time Triage**: When a new issue is opened or reopened, an issue comment that contains `@gemini-cli /triage` is created or when a maintainer of the repo dispatch the triage event, a GitHub Actions workflow is triggered. This workflow uses the Gemini CLI to analyze the issue and apply the most appropriate labels. This provides immediate feedback and categorization of new issues.

2.  **Scheduled Triage**: To catch any issues that might have been missed by the real-time triage, a scheduled workflow runs every hour. This workflow specifically looks for issues that have no labels or have the `status/needs-triage` label. This ensures that all issues are eventually triaged.

## Implementation

For detailed setup instructions, including prerequisites and authentication, please refer to the main [Getting Started](../../README.md#getting-started) and [Configuration](../../README.md#configuration) documentation.

To implement this issue triage system, copy the workflow files into your repository's `.github/workflows` directory:

```bash
mkdir -p .github/workflows
curl -o .github/workflows/gemini-issue-automated-triage.yml https://raw.githubusercontent.com/google-github-actions/run-gemini-cli/main/workflows/issue-triage/gemini-issue-automated-triage.yml
curl -o .github/workflows/gemini-issue-scheduled-triage.yml https://raw.githubusercontent.com/google-github-actions/run-gemini-cli/main/workflows/issue-triage/gemini-issue-scheduled-triage.yml
```

You can customize the prompts and settings in the workflow files to suit your specific needs. For example, you can change the triage logic, the labels that are applied, or the schedule of the scheduled triage.

## Workflows in Detail

### Real-Time Issue Triage

This workflow is defined in `workflows/issue-triage/gemini-issue-automated-triage.yml` and is triggered when an issue is opened or reopened. It uses the Gemini CLI to analyze the issue and apply relevant labels.

If the triage process encounters an error, the workflow will post a comment on the issue, including a link to the action logs for debugging.

### Scheduled Issue Triage

This workflow is defined in `workflows/issue-triage/gemini-issue-scheduled-triage.yml` and runs on a schedule (e.g., every hour). It finds any issues that have no labels or have the `status/needs-triage` label and then uses the Gemini CLI to triage them. This workflow can also be manually triggered.
