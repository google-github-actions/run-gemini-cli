# Gemini CLI Workflows

This directory contains a collection of example workflows that demonstrate how to use the [Google Gemini CLI GitHub Action](https://github.com/google-github-actions/run-gemini-cli). These workflows are designed to be reusable and customizable for your own projects.

## Available Workflows

*   **[Issue Triage](./issue-triage)**: Automatically triage GitHub issues using Gemini. This workflow can be configured to run on a schedule or be triggered by issue events.
*   **[Pull Request Review](./pr-review)**: Automatically review pull requests using Gemini. This workflow can be triggered by pull request events and provides a comprehensive review of the changes.
*   **[Gemini CLI](./gemini-cli)**: A general-purpose, conversational AI assistant that can be invoked within pull requests and issues to perform a wide range of tasks.

## Configuration

### Workflows

#### Timeouts

Each workflow includes a `timeout-minutes` property that you can customize to meet your needs. This property determines the maximum amount of time that a job can run before it is automatically canceled. For more information on configuring timeouts, see the official GitHub documentation for [`jobs.<job_id>.timeout-minutes`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes) and [`jobs.<job_id>.steps.timeout-minutes`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepstimeout-minutes).

To change the timeout for a workflow, open the corresponding YAML file and modify the value of the `timeout-minutes` property. For example, to change the timeout for the Pull Request Review workflow to 10 minutes, you would make the following change:

```yaml
jobs:
  review-pr:
    timeout-minutes: 10
```

## Contributing

We encourage you to contribute to this collection of workflows! If you have a workflow that you would like to share with the community, please open a pull request.

When contributing, please follow these guidelines. For more information on contributing to the project as a whole, please see the [CONTRIBUTING.md](../../CONTRIBUTING.md) file.

*   Create a new directory for your workflow.
*   Include a `README.md` file that explains how to use your workflow.
*   Add your workflow to the list of available workflows in this `README.md` file.

We look forward to seeing what you build!
