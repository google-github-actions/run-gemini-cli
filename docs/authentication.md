# Authentication

This guide covers the different ways to authenticate the Gemini CLI action in your GitHub Actions workflows. You can authenticate using a Gemini API key, or by using Google Cloud's Workload Identity Federation to connect to Vertex AI or Gemini Code Assist.

- [Direct Workload Identity Federation Setup for GitHub Actions](#direct-workload-identity-federation-setup-for-github-actions)
  - [Overview](#overview)
    - [How it Works](#how-it-works)
    - [Automatic Permissions](#automatic-permissions)
  - [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
    - [Required Tools](#required-tools)
    - [Required IAM Permissions](#required-iam-permissions)
  - [Usage](#usage)
    - [Command Line Options](#command-line-options)
    - [Examples](#examples)
    - [What the Script Does](#what-the-script-does)
  - [GitHub Configuration](#github-configuration)
  - [Use Case: Authenticating with a Gemini API Key](#use-case-authenticating-with-a-gemini-api-key)
    - [Prerequisites](#prerequisites-1)
    - [Setup](#setup-1)
    - [Workflow Configuration Example](#workflow-configuration-example)
  - [Use Case: Authenticating with Vertex AI](#use-case-authenticating-with-vertex-ai)
    - [Prerequisites](#prerequisites-2)
    - [Setup](#setup-2)
    - [Workflow Configuration Example](#workflow-configuration-example-1)
  - [Use Case: Authenticating with Gemini Code Assist](#use-case-authenticating-with-gemini-code-assist)
    - [Prerequisites](#prerequisites-3)
    - [Setup](#setup-3)
    - [Workflow Configuration Example](#workflow-configuration-example-2)
  - [Additional Resources](#additional-resources)

## Overview

**Direct Workload Identity Federation** is Google Cloud's preferred method for GitHub Actions authentication. It provides:

- **No intermediate service accounts** - Direct authentication to GCP resources
- **Enhanced security** - No long-lived credentials or keys
- **Simplified setup** - Fewer components to manage
- **Built-in observability** - Automatic logging, monitoring, and tracing permissions

### How it Works

```
GitHub Actions → OIDC Token → Workload Identity Pool → Direct GCP Resource Access
```

### Automatic Permissions

The script automatically grants these essential permissions:

- **`roles/logging.logWriter`** - Write logs to Cloud Logging
- **`roles/monitoring.metricWriter`** - Write metrics to Cloud Monitoring
- **`roles/cloudtrace.agent`** - Send traces to Cloud Trace
- **`roles/aiplatform.user `** - Make inference calls to Vertex AI
- **`roles/cloudaicompanion.user`** - Make inference calls using Code Assist

## Quick Start

```bash
# Basic setup for any repository
./scripts/setup_workload_identity.sh --repo OWNER/REPO

# Example
./scripts/setup_workload_identity.sh --repo google/my-project
```

## Prerequisites

### Required Tools

- **Google Cloud Project** with billing enabled
- **gcloud CLI** installed and authenticated (`gcloud auth login`)
- **Bash shell** (any version)

### Required IAM Permissions

Your user account needs these permissions in the target GCP project:

- `resourcemanager.projects.setIamPolicy`
- `iam.workloadIdentityPools.create`
- `iam.workloadIdentityPools.update`
- `serviceusage.services.enable`

## Usage

### Command Line Options

| Option                             | Description                                    | Example                    |
| ---------------------------------- | ---------------------------------------------- | -------------------------- |
| `--repo OWNER/REPO`                | **Required**: GitHub repository                | `--repo google/my-repo`    |
| `--project GOOGLE_CLOUD_PROJECT`   | GCP project ID (auto-detected if not provided) | `--project my-gcp-project` |
| `--location GOOGLE_CLOUD_LOCATION` | GCP project Location (defaults to 'global')    | `--location us-east1`      |
| `--pool-name NAME`                 | Custom pool name (default: `github`)           | `--pool-name my-pool`      |
| `--help`                           | Show help message                              |                            |

### Examples

```bash
# Basic setup with auto-detected project
./scripts/setup_workload_identity.sh --repo google/my-repo

# With specific project
./scripts/setup_workload_identity.sh --repo google/my-repo --project my-gcp-project

# With specific project location
./scripts/setup_workload_identity.sh --repo google/my-repo --location us-east1

# Custom pool name
./scripts/setup_workload_identity.sh --repo google/my-repo --pool-name my-custom-pool
```

### What the Script Does

1. **Creates Workload Identity Pool**: Shared resource (named `github` by default)
2. **Creates Workload Identity Provider**: Unique per repository
3. **Grants permissions**: Automatic observability and inference permissions
4. **Outputs configuration**: GitHub secrets and workflow example

## GitHub Configuration

After running the script, add these **4 environment variables** to your repository or workflow configuration:

Go to: `https://github.com/OWNER/REPO/settings/variables/actions`

| Environment Variable Name   | Description                              |
| --------------------------- | ---------------------------------------- |
| `GCP_WIF_PROVIDER`          | Workload Identity Provider resource name |
| `OTLP_GOOGLE_CLOUD_PROJECT` | Your Google Cloud project ID             |
| `GOOGLE_CLOUD_PROJECT`      | Your Google Cloud project ID             |
| `GOOGLE_CLOUD_LOCATION`     | Your Google Cloud project Location       |

## Authenticating with a Gemini API Key

This is the simplest method and is suitable for projects that do not require Google Cloud integration.

### Prerequisites

- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Setup

1.  **Create an API Key**: Go to Google AI Studio and create a new API key.
2.  **Add to GitHub Secrets**: In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add a new repository secret with the name `GEMINI_API_KEY` and paste your key as the value.

### Workflow Configuration Example

```yaml
- uses: google-github-actions/run-gemini-cli@main
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  with:
    prompt: "Explain this code"
```

## Authenticating with Vertex AI

This method is for authenticating directly with the Vertex AI API using your GCP project's identity.

### Prerequisites

- A Google Cloud project with the **Vertex AI API** enabled.
- The [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated.

### Setup

1.  **Run the Setup Script**: Use the `setup_workload_identity.sh` script to configure direct Workload Identity Federation.

    ```bash
    ./scripts/setup_workload_identity.sh --repo <OWNER/REPO>
    ```

2.  **Configure GitHub Repository**: The script will output the necessary variables. Add the following to your repository's **Settings > Secrets and variables > Actions**:

    | Variable Name               | Description                                               |
    | --------------------------- | --------------------------------------------------------- |
    | `GCP_WIF_PROVIDER`          | The full resource name of the Workload Identity Provider. |
    | `GOOGLE_CLOUD_PROJECT`      | Your Google Cloud project ID.                             |
    | `GOOGLE_CLOUD_LOCATION`     | Your Google Cloud project Location.                       |
    | `OTLP_GOOGLE_CLOUD_PROJECT` | Your Google Cloud project ID for OTLP.                    |

### Workflow Configuration Example

```yaml
- uses: google-github-actions/run-gemini-cli@main
  env:
    GCP_WIF_PROVIDER: ${{ vars.GCP_WIF_PROVIDER }}
    GOOGLE_CLOUD_PROJECT: ${{ vars.GOOGLE_CLOUD_PROJECT }}
    GOOGLE_CLOUD_LOCATION: ${{ vars.GOOGLE_CLOUD_LOCATION }}
    OTLP_GOOGLE_CLOUD_PROJECT: ${{ vars.OTLP_GOOGLE_CLOUD_PROJECT }}
  with:
    # Your Gemini CLI commands here
    prompt: "Explain this code"
```

## Authenticating with Gemini Code Assist

If you have a **Gemini Code Assist** subscription, you can configure the action to use it for authentication. This method also uses Workload Identity Federation but is configured specifically for the Gemini Code Assist service.

### Prerequisites

- A Google Cloud project with an active Gemini Code Assist subscription.
- The [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated.

### Setup

1.  **Run the Setup Script**: Use the same `setup_workload_identity.sh` script. It will create the necessary pool, provider, and a service account with the required permissions for Gemini Code Assist.

    ```bash
    ./scripts/setup_workload_identity.sh --repo <OWNER/REPO>
    ```

2.  **Configure GitHub Repository**: The script will output the necessary variables. Add the following to your repository's **Settings > Secrets and variables > Actions**:

    | Variable Name           | Description                                               |
    | ----------------------- | --------------------------------------------------------- |
    | `GCP_WIF_PROVIDER`      | The full resource name of the Workload Identity Provider. |
    | `GOOGLE_CLOUD_PROJECT`  | Your Google Cloud project ID.                             |
    | `GOOGLE_GENAI_USE_GCA`  | Set to `true` to use GCP for authentication.              |
    | `SERVICE_ACCOUNT_EMAIL` | The email of the service account created by the script.   |

### Workflow Configuration Example

```yaml
- uses: google-github-actions/run-gemini-cli@main
  env:
    GCP_WIF_PROVIDER: ${{ vars.GCP_WIF_PROVIDER }}
    SERVICE_ACCOUNT_EMAIL: ${{ vars.SERVICE_ACCOUNT_EMAIL }}
    GOOGLE_CLOUD_PROJECT: ${{ vars.GOOGLE_CLOUD_PROJECT }}
    GOOGLE_GENAI_USE_GCA: ${{ vars.GOOGLE_GENAI_USE_GCA }}
  with:
    # Your Gemini CLI commands here
    prompt: "Explain this code"
```

## Additional Resources

- [Google Cloud Direct Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity- federation)
- [google-github-actions/auth Documentation](https://github.com/google-github-actions/auth)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
