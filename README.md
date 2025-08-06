# run-gemini-cli

## Overview

`run-gemini-cli` is a GitHub Action that integrates [Gemini] into your development workflow via the [Gemini CLI]. It acts both as an autonomous agent for critical routine coding tasks, and an on-demand collaborator you can quickly delegate work to.

Use it to perform GitHub pull request reviews, triage issues, perform code analysis and modification, and more using [Gemini] conversationally (e.g., `@gemini-cli fix this issue`) directly inside your GitHub repositories.

- [run-gemini-cli](#run-gemini-cli)
  - [Overview](#overview)
  - [Features](#features)
  - [Quick Start](#quick-start)
    - [1. Get a Gemini API Key](#1-get-a-gemini-api-key)
    - [2. Add it as a GitHub Secret](#2-add-it-as-a-github-secret)
    - [3. Choose a Workflow](#3-choose-a-workflow)
    - [4. Try it out!](#4-try-it-out)
  - [Workflows](#workflows)
    - [Issue Triage](#issue-triage)
    - [Pull Request Review](#pull-request-review)
    - [Gemini CLI Assistant](#gemini-cli-assistant)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
    - [Repository Variables](#repository-variables)
    - [Secrets](#secrets)
  - [Authentication](#authentication)
    - [Google Authentication](#google-authentication)
    - [GitHub Authentication](#github-authentication)
  - [Observability](#observability)
  - [Customization](#customization)
  - [Contributing](#contributing)

## Features

- **Automation**: Trigger workflows based on events (e.g. issue opening) or schedules (e.g. nightly).
- **On-demand Collaboration**: Trigger workflows in issue and pull request
  comments by mentioning the [Gemini CLI] (e.g., `@gemini-cli /review`).
- **Extensible with Tools**: Leverage [Gemini] models' tool-calling capabilities to
  interact with other CLIs like the [GitHub CLI] (`gh`).
- **Customizable**: Use a `GEMINI.md` file in your repository to provide
  project-specific instructions and context to [Gemini CLI].

## Quick Start

Get started with Gemini CLI in your repository in just a few minutes:

### 1. Get a Gemini API Key
Obtain your API key from [Google AI Studio] with generous free-of-charge quotas

### 2. Add it as a GitHub Secret
Store your API key as a secret named `GEMINI_API_KEY` in your repository:
- Go to your repository's **Settings > Secrets and variables > Actions**
- Click **New repository secret**
- Name: `GEMINI_API_KEY`, Value: your API key

### 3. Choose a Workflow
You have two options to set up a workflow:

**Option A: Use setup command (Recommended)**
1. Start the Gemini CLI:

   ```shell
   gemini
   ```

2. In the chat interface, type:

   ```
   /setup-github
   ```

**Option B: Manually copy workflows**
1. Copy the pre-built workflows from the [`examples/workflows`](./examples/workflows) directory to your repository's `.github/workflows` directory.

### 4. Try it out!

**Pull Request Review:**
- Open a pull request in your repository and wait for automatic review
- Comment `@gemini-cli /review` on an existing pull request to manually trigger a review

**Issue Triage:**
- Open an issue and wait for automatic triage
- Comment `@gemini-cli /triage` on existing issues to manually trigger triaging

**General AI Assistance:**
- In any issue or pull request, mention `@gemini-cli` followed by your request
- Examples:
  - `@gemini-cli explain this code change`
  - `@gemini-cli suggest improvements for this function`
  - `@gemini-cli help me debug this error`
  - `@gemini-cli write unit tests for this component`

## Workflows

This action provides several pre-built workflows for different use cases. Each workflow is designed to be copied into your repository's `.github/workflows` directory and customized as needed.

### Issue Triage

This action can be used to triage GitHub Issues automatically or on a schedule.
For a detailed guide on how to set up the issue triage system, go to the
[GitHub Issue Triage workflow documentation](./examples/workflows/issue-triage).

### Pull Request Review

This action can be used to automatically review pull requests when they are
opened. For a detailed guide on how to set up the pull request review system,
go to the [GitHub PR Review workflow documentation](./examples/workflows/pr-review).

### Gemini CLI Assistant

This type of action can be used to invoke a general-purpose, conversational Gemini
AI assistant within the pull requests and issues to perform a wide range of
tasks. For a detailed guide on how to set up the general-purpose Gemini CLI workflow,
go to the [Gemini CLI workflow documentation](./examples/workflows/gemini-cli).

### Inputs

<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="prompt"></a><a href="#user-content-prompt"><code>prompt</code></a>: _(Optional, default: `You are a helpful assistant.`)_ A string passed to the Gemini CLI's [`--prompt` argument](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#command-line-arguments).

-   <a name="settings"></a><a href="#user-content-settings"><code>settings</code></a>: _(Optional)_ A JSON string written to `.gemini/settings.json` to configure the CLI's _project_ settings.
    For more details, see the documentation on [settings files](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#settings-files).

-   <a name="gemini_api_key"></a><a href="#user-content-gemini_api_key"><code>gemini_api_key</code></a>: _(Optional)_ The API key for the Gemini API.

-   <a name="gcp_project_id"></a><a href="#user-content-gcp_project_id"><code>gcp_project_id</code></a>: _(Optional)_ The Google Cloud project ID.

-   <a name="gcp_location"></a><a href="#user-content-gcp_location"><code>gcp_location</code></a>: _(Optional)_ The Google Cloud location.

-   <a name="gcp_workload_identity_provider"></a><a href="#user-content-gcp_workload_identity_provider"><code>gcp_workload_identity_provider</code></a>: _(Optional)_ The Google Cloud Workload Identity Provider.

-   <a name="gcp_service_account"></a><a href="#user-content-gcp_service_account"><code>gcp_service_account</code></a>: _(Optional)_ The Google Cloud service account email.

-   <a name="use_vertex_ai"></a><a href="#user-content-use_vertex_ai"><code>use_vertex_ai</code></a>: _(Optional, default: `false`)_ A flag to indicate if Vertex AI should be used.

-   <a name="use_gemini_code_assist"></a><a href="#user-content-use_gemini_code_assist"><code>use_gemini_code_assist</code></a>: _(Optional, default: `false`)_ A flag to indicate if Gemini Code Assist should be used.

-   <a name="gemini_cli_version"></a><a href="#user-content-gemini_cli_version"><code>gemini_cli_version</code></a>: _(Optional, default: `latest`)_ The version of the Gemini CLI to install.


<!-- END_AUTOGEN_INPUTS -->

### Outputs

<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   `summary`: The summarized output from the Gemini CLI execution.


<!-- END_AUTOGEN_OUTPUTS -->

### Repository Variables

We recommend setting the following values as repository variables so they can be reused across all workflows. Alternatively, you can set them inline as action inputs in individual workflows or to override repository-level values.

| Name                        | Description                                            | Type     | Required | When Required             |
| --------------------------- | ------------------------------------------------------ | -------- | -------- | ------------------------- |
| `GEMINI_CLI_VERSION`        | Controls which version of the Gemini CLI is installed. | Variable | No       | Pinning the CLI version   |
| `GCP_WIF_PROVIDER`          | Full resource name of the Workload Identity Provider.  | Variable | No       | Using Google Cloud        |
| `GOOGLE_CLOUD_PROJECT`      | Google Cloud project for inference and observability.  | Variable | No       | Using Google Cloud        |
| `SERVICE_ACCOUNT_EMAIL`     | Google Cloud service account email address.            | Variable | No       | Using Google Cloud        |
| `GOOGLE_CLOUD_LOCATION`     | Region of the Google Cloud project.                    | Variable | No       | Using Google Cloud        |
| `GOOGLE_GENAI_USE_VERTEXAI` | Set to `true` to use Vertex AI                         | Variable | No       | Using Vertex AI           |
| `GOOGLE_GENAI_USE_GCA`      | Set to `true` to use Gemini Code Assist                | Variable | No       | Using Gemini Code Assist  |
| `APP_ID`                    | GitHub App ID for custom authentication.               | Variable | No       | Using a custom GitHub App |


To add a repository variable:
1) Go to your repository's **Settings > Secrets and variables > Actions > New variable**.
2) Enter the variable name and value.
3) Save.

For details about repository variables, refer to the [GitHub documentation on variables][variables].

### Secrets

You can set the following secrets in your repository:

| Name              | Description                                   | Required | When Required                 |
| ----------------- | --------------------------------------------- | -------- | ----------------------------- |
| `GEMINI_API_KEY`  | Your Gemini API key from Google AI Studio.    | No       | You don't have a GCP project. |
| `APP_PRIVATE_KEY` | Private key for your GitHub App (PEM format). | No       | Using a custom GitHub App.    |

To add a secret:

1. Go to your repository's **Settings > Secrets and variables >Actions > New repository secret**.
2. Enter the secret name and value.
3. Save.

For more information, refer to the
[official GitHub documentation on creating and using encrypted secrets][secrets].

## Authentication

This action requires authentication to both Google services (for Gemini AI) and the GitHub API.

### Google Authentication

Choose the authentication method that best fits your use case:

1. **Gemini API Key:** The simplest method for projects that don't require Google Cloud integration
2. **Workload Identity Federation:** The most secure method for authenticating to Google Cloud services

### GitHub Authentication

You can authenticate with GitHub in two ways:

1.  **Default `GITHUB_TOKEN`:** For simpler use cases, the action can use the
    default `GITHUB_TOKEN` provided by the workflow.
2.  **Custom GitHub App (Recommended):** For the most secure and flexible
    authentication, we recommend creating a custom GitHub App.

For detailed setup instructions for both Google and GitHub authentication, go to the
[**Authentication documentation**](./docs/authentication.md).

## Observability

This action can be configured to send telemetry data (traces, metrics, and logs)
to your own Google Cloud project. This allows you to monitor the performance and
behavior of the [Gemini CLI] within your workflows, providing valuable insights
for debugging and optimization.

For detailed instructions on how to set up and configure observability, go to
the [Observability documentation](./docs/observability.md).

## Customization

Create a [GEMINI.md] file in the root of your repository to provide
project-specific context and instructions to [Gemini CLI]. This is useful for defining
coding conventions, architectural patterns, or other guidelines the model should
follow for a given repository.

## Contributing

Contributions are welcome! Check out the Gemini CLI
[**Contributing Guide**](./CONTRIBUTING.md) for more details on how to get
started.

[secrets]: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions
[settings_json]: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#settings-files
[Gemini]: https://deepmind.google/models/gemini/
[Google AI Studio]: https://aistudio.google.com/apikey
[Gemini CLI]: https://github.com/google-gemini/gemini-cli/
[Google Cloud support]: https://cloud.google.com/support
[variables]: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables#creating-configuration-variables-for-a-repository
[GitHub CLI]: https://docs.github.com/en/github-cli/github-cli
[GEMINI.md]: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#context-files-hierarchical-instructional-context
