# run-gemini-cli

`run-gemini-cli` is a GitHub Action that integrates [Gemini] AI into your development
workflow via the [Gemini CLI]. You can use it to perform GitHub pull request reviews, triage
issues, perform code analysis and modification, and more using [Gemini] conversationally
(e.g., `@gemini-cli /review`) directly inside your GitHub repositories.

**This is not an officially supported Google product, and it is not covered by a
Google Cloud support contract. To report bugs or request features in a Google
Cloud product, please contact [Google Cloud support].**

- [run-gemini-cli](#run-gemini-cli)
  - [Features](#features)
  - [Getting Started](#getting-started)
  - [Configuration](#configuration)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
    - [Environment Variables](#environment-variables)
    - [Secrets](#secrets)
  - [Workflows](#workflows)
    - [Issue Triage](#issue-triage)
    - [Pull Request Review](#pull-request-review)
    - [Generic Gemini CLI](#generic-gemini-cli)
  - [Authentication](#authentication)
  - [Observability with OpenTelemetry](#observability-with-opentelemetry)
    - [OpenTelemetry in Google Cloud](#opentelemetry-in-google-cloud)
  - [Customization](#customization)
  - [Contributing](#contributing)

## Features

- **Extensible with Tools**: Leverage [Gemini] models' tool-calling capabilities to
  interact with other CLIs like the [GitHub CLI] (`gh`) for powerful automations.
- **Customizable**: Use a `GEMINI.md` file in your repository to provide
  project-specific instructions and context to [Gemini CLI].
- **Comment-based Interaction**: Trigger workflows in issue and pull request
  comments by mentioning the [Gemini CLI] (e.g., `@gemini-cli /review`).

## Getting Started

Before using the Gemini CLI GitHub Action, make sure to:

1.  **Get a Gemini API Key**: Obtain your API key from [Google AI Studio].
2.  **Add it as a GitHub Secret**: Store your API key as a secret in your
    repository with the name `GEMINI_API_KEY`. For more information, see the
    [official GitHub documentation on creating and using encrypted secrets][secrets].

## Configuration

The Gemini CLI GitHub Action is configured via a combination of workflow inputs, outputs,
environment variables, and secrets.

### Inputs

<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="prompt"></a><a href="#user-content-prompt"><code>prompt</code></a>: _(Optional, default: `You are a helpful assistant.`)_ A string passed to the Gemini CLI's [`--prompt` argument](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#command-line-arguments).

-   <a name="settings"></a><a href="#user-content-settings"><code>settings</code></a>: _(Optional)_ A JSON string written to `.gemini/settings.json` to configure the CLI's _project_ settings.
    For more details, see the documentation on [settings files](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#settings-files).


<!-- END_AUTOGEN_INPUTS -->

### Outputs

<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   `summary`: The summarized output from the Gemini CLI execution.


<!-- END_AUTOGEN_OUTPUTS -->

### Environment Variables

Set the following environment variables in your repository or workflow:

| Name                      | Description                                                                                                                                               | Type     | Required | When Required                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ----------------------------------- |
| GEMINI_CLI_VERSION        | Controls which version of the Gemini CLI is installed. Supports `npm` versions (e.g., `0.1.0`, `latest`), a branch name (e.g., `main`), or a commit hash. | Variable | No       | To pin or override the CLI version  |
| GCP_WIF_PROVIDER          | Full resource name of the Workload Identity Provider.                                                                                                     | Variable | No       | When using observability            |
| OTLP_GOOGLE_CLOUD_PROJECT | Google Cloud project for telemetry.                                                                                                                       | Variable | No       | When using observability            |
| GOOGLE_CLOUD_PROJECT      | Google Cloud project for Vertex AI authentication.                                                                                                        | Variable | No       | When using Vertex AI authentication |
| GOOGLE_CLOUD_LOCATION     | Geographic location of the Google Cloud project for Vertex AI authentication.                                                                             | Variable | No       | When using Vertex AI authentication |
| GOOGLE_GENAI_USE_VERTEXAI | Set to 'true' to use Vertex AI                                                                                                                            | Variable | No       | When using Vertex AI authentication |
| APP_ID                    | GitHub App ID for custom authentication.                                                                                                                  | Variable | No       | When using a custom GitHub App      |


To add an environment variable: 1) Go to your repository's **Settings > Secrets and
variables > Actions > New variable**; 2) Enter the variable name and value; and 3) Save.
For organization-wide or environment-specific variables, refer to the
[GitHub documentation on variables][variables].

### Secrets

The following secrets are required for security:

| Name            | Description                                   | Required | When Required                                             |
| --------------- | --------------------------------------------- | -------- | --------------------------------------------------------- |
| GEMINI_API_KEY  | Your Gemini API key from Google AI Studio.    | No       | If you are using the Gemini API key from Google AI Studio |
| APP_PRIVATE_KEY | Private key for your GitHub App (PEM format). | No       | If you are using a custom GitHub App                      |

To add a secret, go to your repository's **Settings > Secrets and variables >
Actions > New repository secret**. For more information, refer to the
[official GitHub documentation on creating and using encrypted secrets][secrets].

## Workflows

Workflows include Issue Triage, Pull Request Review. and Generic Gemini CLI. To use
this GitHub Action, you need to create a workflow file in your repository (e.g.,
`.github/workflows/gemini.yml`). The best way to get started is to copy one of the pre-built workflows from the
[`/workflows`](./workflows) directory into your project's `.github/workflows`
folder and customize it.

Below are specific examples of workflows:

### Issue Triage

This action can be used to triage GitHub Issues automatically or on a schedule.
For a detailed guide on how to set up the issue triage system, go to the
[GitHub Issue Triage workflow documentation](./workflows/issue-triage).

### Pull Request Review

This action can be used to automatically review pull requests when they are
opened. Additionally, users with `OWNER`, `MEMBER`, or `COLLABORATOR`
permissions can trigger a review by commenting `@gemini-cli /review` in a pull
request.

For a detailed guide on how to set up the pull request review system, go to the
[GitHub PR Review workflow documentation](./workflows/pr-review).

### Generic Gemini CLI

This type of action can be used to invoke a general-purpose, conversational Gemini
AI assistant within the pull requests and issues to perform a wide range of
tasks. For a detailed guide on how to set up the [Gemini CLI], go to the Generic
[Gemini CLI workflow documentation](./workflows/gemini-cli).

## Authentication

This action requires a GitHub token to interact with the GitHub API. You can
authenticate in two ways:

1.  **Custom GitHub App (Recommended):** For the most secure and flexible
    authentication, we recommend creating a custom GitHub App.
2.  **Default `GITHUB_TOKEN`:** For simpler use cases, the action can use the
    default `GITHUB_TOKEN` provided by the workflow.

For a detailed guide on how to set up authentication, including creating a
custom app and the required permissions, go to the
[**Authentication documentation**](./docs/github-app.md).

## Observability with OpenTelemetry

This action can be configured to send telemetry data (traces, metrics, and logs)
to your own Google Cloud project. This allows you to monitor the performance and
behavior of the [Gemini CLI] within your workflows, providing valuable insights
for debugging and optimization.

For detailed instructions on how to set up and configure observability, go to
the [Observability documentation](./docs/observability.md).

### OpenTelemetry in Google Cloud

To use observability features with Google Cloud, you'll need to set up Workload
Identity Federation. For detailed setup instructions, check out the
[Workload Identity Federation documentation](./docs/workload-identity.md).

## Customization

Create a `GEMINI.md` file in the root of your repository to provide
project-specific context and instructions to [Gemini CLI]. This is useful for defining
coding conventions, architectural patterns, or other guidelines the model should
follow.

## Contributing

Contributions are welcome! Check out the Gemini CLI
[**Contributing Guide**](./CONTRIBUTING.md) for more details on how to get
started.

[secrets]: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions
[settings_json]: https://github.com/google-gemini/gemini-cli/blob/main/docs/
[Gemini]: https://deepmind.google/models/gemini/
[Google AI Studio]: https://aistudio.google.com/apikey
[Gemini CLI]: https://github.com/google-gemini/gemini-cli/
[Google Cloud support]: https://cloud.google.com/support
[variables]: https://docs.github.com/en/actions/learn-github-actions/variables
[GitHub CLI]: https://docs.github.com/en/github-cli/github-cli
