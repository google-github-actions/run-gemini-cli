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
    - [3. Update your .gitignore](#3-update-your-gitignore)
    - [4. Choose a Workflow](#4-choose-a-workflow)
    - [5. Try it out!](#5-try-it-out)
  - [Workflows](#workflows)
    - [Gemini Dispatch](#gemini-dispatch)
    - [Issue Triage](#issue-triage)
    - [Pull Request Review](#pull-request-review)
    - [Gemini CLI Assistant](#gemini-cli-assistant)
  - [Configuration](#configuration)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
    - [Repository Variables](#repository-variables)
    - [Secrets](#secrets)
  - [Authentication](#authentication)
    - [Google Authentication](#google-authentication)
    - [GitHub Authentication](#github-authentication)
  - [Observability](#observability)
  - [Extensions](#extensions)
  - [Best Practices](#best-practices)
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

### 3. Update your .gitignore

Add the following entries to your `.gitignore` file:

```gitignore
# gemini-cli settings
.gemini/

# GitHub App credentials
gha-creds-*.json
```

### 4. Choose a Workflow

You have two options to set up a workflow:

**Option A: Use setup command (Recommended)**

1. Start the Gemini CLI in your terminal:

   ```shell
   gemini
   ```

2. In Gemini CLI in your terminal, type:

   ```
   /setup-github
   ```

**Option B: Manually copy workflows**

1. Copy the pre-built workflows from the [`examples/workflows`](./examples/workflows) directory to your repository's `.github/workflows` directory. Note: the `gemini-dispatch.yml` workflow must also be copied, which triggers the workflows to run.

### 5. Try it out!

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

### Gemini Dispatch

This workflow acts as a central dispatcher for Gemini CLI, routing requests to
the appropriate workflow based on the triggering event and the command provided
in the comment. For a detailed guide on how to set up the dispatch workflow, go
to the
[Gemini Dispatch workflow documentation](./examples/workflows/gemini-dispatch).

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
go to the [Gemini Assistant workflow documentation](./examples/workflows/gemini-assistant).

## Configuration

### Inputs

<!-- prettier-ignore-start -->
<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="__input_gcp_location"></a><a href="#user-content-__input_gcp_location"><code>gcp_location</code></a>: _(Optional)_ The Google Cloud location.

-   <a name="__input_gcp_project_id"></a><a href="#user-content-__input_gcp_project_id"><code>gcp_project_id</code></a>: _(Optional)_ The Google Cloud project ID.

-   <a name="__input_gcp_service_account"></a><a href="#user-content-__input_gcp_service_account"><code>gcp_service_account</code></a>: _(Optional)_ The Google Cloud service account email.

-   <a name="__input_gcp_workload_identity_provider"></a><a href="#user-content-__input_gcp_workload_identity_provider"><code>gcp_workload_identity_provider</code></a>: _(Optional)_ The Google Cloud Workload Identity Provider.

-   <a name="__input_gcp_token_format"></a><a href="#user-content-__input_gcp_token_format"><code>gcp_token_format</code></a>: _(Optional, default: `access_token`)_ The token format for authentication. Set to "access_token" to generate access tokens (requires service account), or set to empty string for direct WIF. Can be "access_token" or "id_token".

-   <a name="__input_gcp_access_token_scopes"></a><a href="#user-content-__input_gcp_access_token_scopes"><code>gcp_access_token_scopes</code></a>: _(Optional, default: `https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile`)_ The access token scopes when using token_format "access_token". Comma-separated list of OAuth 2.0 scopes.

-   <a name="__input_gemini_api_key"></a><a href="#user-content-__input_gemini_api_key"><code>gemini_api_key</code></a>: _(Optional)_ The API key for the Gemini API.

-   <a name="__input_gemini_cli_version"></a><a href="#user-content-__input_gemini_cli_version"><code>gemini_cli_version</code></a>: _(Optional, default: `latest`)_ The version of the Gemini CLI to install. Can be "latest", "preview", "nightly", a specific version number, or a git branch, tag, or commit. For more information, see [Gemini CLI releases](https://github.com/google-gemini/gemini-cli/blob/main/docs/releases.md).

-   <a name="__input_gemini_debug"></a><a href="#user-content-__input_gemini_debug"><code>gemini_debug</code></a>: _(Optional)_ Enable debug logging and output streaming.

-   <a name="__input_gemini_model"></a><a href="#user-content-__input_gemini_model"><code>gemini_model</code></a>: _(Optional)_ The model to use with Gemini.

-   <a name="__input_google_api_key"></a><a href="#user-content-__input_google_api_key"><code>google_api_key</code></a>: _(Optional)_ The Vertex AI API key to use with Gemini.

-   <a name="__input_prompt"></a><a href="#user-content-__input_prompt"><code>prompt</code></a>: _(Optional, default: `You are a helpful assistant.`)_ A string passed to the Gemini CLI's [`--prompt` argument](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#command-line-arguments).

-   <a name="__input_settings"></a><a href="#user-content-__input_settings"><code>settings</code></a>: _(Optional)_ A JSON string written to `.gemini/settings.json` to configure the CLI's _project_ settings.
    For more details, see the documentation on [settings files](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#settings-files).

-   <a name="__input_use_gemini_code_assist"></a><a href="#user-content-__input_use_gemini_code_assist"><code>use_gemini_code_assist</code></a>: _(Optional, default: `false`)_ Whether to use Code Assist for Gemini model access instead of the default Gemini API key.
    For more information, see the [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/authentication.md).

-   <a name="__input_use_vertex_ai"></a><a href="#user-content-__input_use_vertex_ai"><code>use_vertex_ai</code></a>: _(Optional, default: `false`)_ Whether to use Vertex AI for Gemini model access instead of the default Gemini API key.
    For more information, see the [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/authentication.md).

-   <a name="__input_extensions"></a><a href="#user-content-__input_extensions"><code>extensions</code></a>: _(Optional)_ A list of Gemini CLI extensions to install.

-   <a name="__input_upload_artifacts"></a><a href="#user-content-__input_upload_artifacts"><code>upload_artifacts</code></a>: _(Optional, default: `false`)_ Whether to upload artifacts to the github action.

-   <a name="__input_use_pnpm"></a><a href="#user-content-__input_use_pnpm"><code>use_pnpm</code></a>: _(Optional, default: `false`)_ Whether or not to use pnpm instead of npm to install gemini-cli

-   <a name="__input_workflow_name"></a><a href="#user-content-__input_workflow_name"><code>workflow_name</code></a>: _(Optional, default: `${{ github.workflow }}`)_ The GitHub workflow name, used for telemetry purposes.


<!-- END_AUTOGEN_INPUTS -->
<!-- prettier-ignore-end -->

### Outputs

<!-- prettier-ignore-start -->
<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   <a name="__output_summary"></a><a href="#user-content-__output_summary"><code>summary</code></a>: The summarized output from the Gemini CLI execution.

-   <a name="__output_error"></a><a href="#user-content-__output_error"><code>error</code></a>: The error output from the Gemini CLI execution, if any.


<!-- END_AUTOGEN_OUTPUTS -->
<!-- prettier-ignore-end -->

### Repository Variables

We recommend setting the following values as repository variables so they can be reused across all workflows. Alternatively, you can set them inline as action inputs in individual workflows or to override repository-level values.

| Name                        | Description                                                                                                                    | Type     | Required | When Required                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | ------------------------------ |
| `GEMINI_DEBUG`              | Enables debug logging for the Gemini CLI.                                                                                      | Variable | No       | Never                          |
| `GEMINI_CLI_VERSION`        | Controls which version of the Gemini CLI is installed.                                                                         | Variable | No       | Pinning the CLI version        |
| `GCP_WIF_PROVIDER`          | Full resource name of the Workload Identity Provider.                                                                          | Variable | No       | Using Google Cloud             |
| `GOOGLE_CLOUD_PROJECT`      | Google Cloud project for inference and observability.                                                                          | Variable | No       | Using Google Cloud             |
| `SERVICE_ACCOUNT_EMAIL`     | Google Cloud service account email address. Optional - only needed for WIF with service account (not required for direct WIF). | Variable | No       | Using WIF with service account |
| `GOOGLE_CLOUD_LOCATION`     | Region of the Google Cloud project.                                                                                            | Variable | No       | Using Google Cloud             |
| `GOOGLE_GENAI_USE_VERTEXAI` | Set to `true` to use Vertex AI                                                                                                 | Variable | No       | Using Vertex AI                |
| `GOOGLE_GENAI_USE_GCA`      | Set to `true` to use Gemini Code Assist                                                                                        | Variable | No       | Using Gemini Code Assist       |
| `APP_ID`                    | GitHub App ID for custom authentication.                                                                                       | Variable | No       | Using a custom GitHub App      |

[!WARNING] Do not use the `DEBUG` environment variable as it causes the Gemini CLI to hang waiting for node debugger to attach.

To add a repository variable:

1. Go to your repository's **Settings > Secrets and variables > Actions > New variable**.
2. Enter the variable name and value.
3. Save.

For details about repository variables, refer to the [GitHub documentation on variables][variables].

### Secrets

You can set the following secrets in your repository:

| Name              | Description                                   | Required | When Required                         |
| ----------------- | --------------------------------------------- | -------- | ------------------------------------- |
| `GEMINI_API_KEY`  | Your Gemini API key from Google AI Studio.    | No       | You don't have a GCP project.         |
| `APP_PRIVATE_KEY` | Private key for your GitHub App (PEM format). | No       | Using a custom GitHub App.            |
| `GOOGLE_API_KEY`  | Your Google API Key to use with Vertex AI.    | No       | You have a express Vertex AI account. |

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

## Extensions

The Gemini CLI can be extended with additional functionality through extensions.
These extensions are installed from source from their GitHub repositories.

For detailed instructions on how to set up and configure extensions, go to the
[Extensions documentation](./docs/extensions.md).

## Best Practices

To ensure the security, reliability, and efficiency of your automated workflows, we strongly recommend following our best practices. These guidelines cover key areas such as repository security, workflow configuration, and monitoring.

Key recommendations include:

- **Securing Your Repository:** Implementing branch and tag protection, and restricting pull request approvers.
- **Workflow Configuration:** Using Workload Identity Federation for secure authentication to Google Cloud, managing secrets effectively, and pinning action versions to prevent unexpected changes.
- **Monitoring and Auditing:** Regularly reviewing action logs and enabling OpenTelemetry for deeper insights into performance and behavior.

For a comprehensive guide on securing your repository and workflows, please refer to our [**Best Practices documentation**](./docs/best-practices.md).

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
