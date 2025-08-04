# Gemini CLI Workflows

This directory contains a collection of example workflows that demonstrate how to use the [Google Gemini CLI GitHub Action](https://github.com/google-github-actions/run-gemini-cli). These workflows are designed to be reusable and customizable for your own projects.

- [Gemini CLI Workflows](#gemini-cli-workflows)
  - [Available Workflows](#available-workflows)
  - [Setup](#setup)
  - [Customizing Workflows](#customizing-workflows)
    - [How to Configure Gemini CLI](#how-to-configure-gemini-cli)
      - [Key Settings](#key-settings)
        - [Conversation Length (`maxSessionTurns`)](#conversation-length-maxsessionturns)
      - [Custom Context and Guidance (`GEMINI.md`)](#custom-context-and-guidance-geminimd)
    - [GitHub Actions Workflow Settings](#github-actions-workflow-settings)
      - [Setting Timeouts](#setting-timeouts)
      - [Required Permissions](#required-permissions)
  - [Contributing](#contributing)

## Available Workflows

*   **[Issue Triage](./issue-triage)**: Automatically triage GitHub issues using Gemini. This workflow can be configured to run on a schedule or be triggered by issue events.
*   **[Pull Request Review](./pr-review)**: Automatically review pull requests using Gemini. This workflow can be triggered by pull request events and provides a comprehensive review of the changes.
*   **[Gemini CLI Assistant](./gemini-cli)**: A general-purpose, conversational AI assistant that can be invoked within pull requests and issues to perform a wide range of tasks.

## Setup

For detailed setup instructions, including prerequisites and authentication, please refer to the main [Authentication documentation](../../docs/authentication.md).

To use a workflow, you can utilize either of the following steps:
- Run the `/setup-github` command in Gemini CLI on your terminal to set up workflows for your repository.
- Copy the workflow files into your repository's `.github/workflows` directory.

## Customizing Workflows

Gemini CLI workflows are highly configurable. You can adjust their behavior by editing the corresponding `.yml` files in your repository.

### How to Configure Gemini CLI

Gemini CLI supports many settings that control how it operates. For a complete list, see the [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#available-settings-in-settingsjson).

#### Key Settings

##### Conversation Length (`maxSessionTurns`)

This setting controls the maximum number of conversational turns (messages exchanged) allowed during a workflow run.

**Default values by workflow:**

| Workflow                               | Default `maxSessionTurns` |
| -------------------------------------- | ------------------------- |
| [Issue Triage](./issue-triage)         | 25                        |
| [Pull Request Review](./pr-review)     | 20                        |
| [Gemini CLI Assistant](./gemini-cli)   | 50                        |

**How to override:**

Add the following to your workflow YAML file to set a custom value:

```yaml
with:
  settings: |-
    {
      "maxSessionTurns": 10
    }
```

#### Custom Context and Guidance (`GEMINI.md`)

To provide Gemini CLI with custom instructions—such as coding conventions, architectural patterns, or other guidance—add a `GEMINI.md` file to the root of your repository. Gemini CLI will use the content of this file to inform its responses.

### GitHub Actions Workflow Settings

#### Setting Timeouts

You can control how long Gemini CLI runs by using either the `timeout-minutes` field in your workflow YAML, or by specifying a timeout in the `settings` input.

#### Required Permissions

Only users with the following roles can trigger the workflow:

- Repository Owner (`OWNER`)
- Repository Member (`MEMBER`)
- Repository Collaborator (`COLLABORATOR`)

## Contributing

We encourage you to contribute to this collection of workflows! If you have a workflow that you would like to share with the community, please open a pull request.

When contributing, please follow these guidelines. For more information on contributing to the project as a whole, please see the [CONTRIBUTING.md](../../CONTRIBUTING.md) file.

*   Create a new directory for your workflow.
*   Include a `README.md` file that explains how to use your workflow.
*   Add your workflow to the list of available workflows in this `README.md` file.

We look forward to seeing what you build!
