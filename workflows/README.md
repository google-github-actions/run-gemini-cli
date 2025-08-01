# Gemini CLI Workflows

This directory contains a collection of example workflows that demonstrate how to use the [Google Gemini CLI GitHub Action](https://github.com/google-github-actions/run-gemini-cli). These workflows are designed to be reusable and customizable for your own projects.

- [Gemini CLI Workflows](#gemini-cli-workflows)
    - [Environment Variables](#environment-variables)
  - [Available Workflows](#available-workflows)
  - [Customizing Workflows](#customizing-workflows)
    - [How to Configure Gemini CLI](#how-to-configure-gemini-cli)
      - [Key Settings](#key-settings)
        - [Conversation Length (`maxSessionTurns`)](#conversation-length-maxsessionturns)
      - [Custom Context and Guidance (`GEMINI.md`)](#custom-context-and-guidance-geminimd)
    - [GitHub Actions Workflow Settings](#github-actions-workflow-settings)
      - [Setting Timeouts](#setting-timeouts)
  - [Contributing](#contributing)

### Environment Variables

Set the following environment variables in your repository:

| Name                      | Description                                            | Type     | Required | When Required                      |
| ------------------------- | ------------------------------------------------------ | -------- | -------- | ---------------------------------- |
| GEMINI_CLI_VERSION        | Controls which version of the Gemini CLI is installed. | Variable | No       | To pin or override the CLI version |
| GCP_WIF_PROVIDER          | Full resource name of the Workload Identity Provider.  | Variable | No       | When using Google CLoud            |
| GOOGLE_CLOUD_PROJECT      | Google Cloud project for inference and observability.  | Variable | No       | When using Google Cloud            |
| SERVICE_ACCOUNT_EMAIL     | Google Cloud project for inference and observability.  | Variable | No       | When using Google Cloud            |
| GOOGLE_CLOUD_LOCATION     | Region of the Google Cloud project.                    | Variable | No       | When using Google Cloud            |
| GOOGLE_GENAI_USE_VERTEXAI | Set to 'true' to use Vertex AI                         | Variable | No       | When using Vertex AI               |
| GOOGLE_GENAI_USE_GCA      | Set to 'true' to use Gemini Code Assist                | Variable | No       | When using Gemini Code Assist      |

| APP_ID                    | GitHub App ID for custom authentication.               | Variable | No       | When using a custom GitHub App     |

SERVICE_ACCOUNT_EMAIL

To add an environment variable: 1) Go to your repository's **Settings > Secrets and
variables > Actions > New variable**; 2) Enter the variable name and value; and 3) Save.
For organization-wide or environment-specific variables, refer to the
[GitHub documentation on variables][variables].

## Available Workflows

*   **[Issue Triage](./issue-triage)**: Automatically triage GitHub issues using Gemini. This workflow can be configured to run on a schedule or be triggered by issue events.
*   **[Pull Request Review](./pr-review)**: Automatically review pull requests using Gemini. This workflow can be triggered by pull request events and provides a comprehensive review of the changes.
*   **[Gemini CLI](./gemini-cli)**: A general-purpose, conversational AI assistant that can be invoked within pull requests and issues to perform a wide range of tasks.

## Customizing Workflows

Gemini CLI workflows are highly configurable. You can adjust their behavior by editing the corresponding `.yml` files in your repository.

### How to Configure Gemini CLI

Gemini CLI supports many settings that control how it operates. For a complete list, see the [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#available-settings-in-settingsjson).

#### Key Settings

##### Conversation Length (`maxSessionTurns`)

This setting controls the maximum number of conversational turns (messages exchanged) allowed during a workflow run.

**Default values by workflow:**

| Workflow                                     | Default `maxSessionTurns` |
| -------------------------------------------- | ------------------------- |
| [Issue Triage](./workflows/issue-triage)     | 25                        |
| [Pull Request Review](./workflows/pr-review) | 20                        |
| [Generic Gemini CLI](./workflows/gemini-cli) | 50                        |

**How to override:**

Add the following to your workflow YAML file to set a custom value:

```yaml
with:
  settings: |
    {
      "maxSessionTurns": 10
    }
```

#### Custom Context and Guidance (`GEMINI.md`)

To provide Gemini CLI with custom instructions—such as coding conventions, architectural patterns, or other guidance—add a `GEMINI.md` file to the root of your repository. Gemini CLI will use the content of this file to inform its responses.

### GitHub Actions Workflow Settings

#### Setting Timeouts

You can control how long Gemini CLI runs by using either the `timeout-minutes` field in your workflow YAML, or by specifying a timeout in the `settings` input.

## Contributing

We encourage you to contribute to this collection of workflows! If you have a workflow that you would like to share with the community, please open a pull request.

When contributing, please follow these guidelines. For more information on contributing to the project as a whole, please see the [CONTRIBUTING.md](../../CONTRIBUTING.md) file.

*   Create a new directory for your workflow.
*   Include a `README.md` file that explains how to use your workflow.
*   Add your workflow to the list of available workflows in this `README.md` file.

We look forward to seeing what you build!
