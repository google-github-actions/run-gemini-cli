# Authentication

This guide covers the different ways to authenticate the Gemini CLI action in your GitHub Actions workflows.

- [Authentication](#authentication)
  - [Choosing an Authentication Method](#choosing-an-authentication-method)
  - [Method 1: Authenticating with a Gemini API Key](#method-1-authenticating-with-a-gemini-api-key)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [Workflow Configuration Example](#workflow-configuration-example)
  - [Method 2: Authenticating with Workload Identity Federation](#method-2-authenticating-with-workload-identity-federation)
    - [How it Works](#how-it-works)
    - [Setup Script: `setup_workload_identity.sh`](#setup-script-setup_workload_identitysh)
      - [Quick Start](#quick-start)
      - [Prerequisites](#prerequisites-1)
      - [Usage](#usage)
      - [What the Script Does](#what-the-script-does)
      - [Automatic Permissions](#automatic-permissions)
    - [Connecting to Vertex AI](#connecting-to-vertex-ai)
      - [Prerequisites](#prerequisites-2)
      - [GitHub Configuration](#github-configuration)
      - [Workflow Configuration Example](#workflow-configuration-example-1)
    - [Connecting to Gemini Code Assist](#connecting-to-gemini-code-assist)
      - [Prerequisites](#prerequisites-3)
      - [GitHub Configuration](#github-configuration-1)
      - [Workflow Configuration Example](#workflow-configuration-example-2)
  - [Additional Resources](#additional-resources)

## Choosing an Authentication Method

There are two primary methods for authenticating this action. Choose the one that best fits your use case.

| Method                           | Use Case                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| **Gemini API Key**               | The simplest method. Ideal for projects that do not require Google Cloud integration. |
| **Workload Identity Federation** | The most secure method for authenticating to Google Cloud services.                   |

## Method 1: Authenticating with a Gemini API Key

This is the simplest method and is suitable for projects that do not require Google Cloud integration.

### Prerequisites

- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Setup

1.  **Create an API Key**: Go to Google AI Studio and create a new API key.
2.  **Add to GitHub Secrets**: In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add a new repository secret with the name `GEMINI_API_KEY` and paste your key as the value.

### Workflow Configuration Example

```yaml
- uses: google-github-actions/run-gemini-cli@main
  with:
    prompt: "Explain this code"
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

## Method 2: Authenticating with Workload Identity Federation

**Workload Identity Federation** is Google Cloud's preferred, keyless authentication method for GitHub Actions. It provides:

- **Enhanced security**: No long-lived credentials or keys to manage.
- **Simplified setup**: A single script configures the necessary resources.
- **Built-in observability**: Automatic permissions for logging, monitoring, and tracing.

### How it Works

The process uses GitHub's OIDC tokens to directly and securely access Google Cloud resources.

```
GitHub Actions → OIDC Token → Workload Identity Pool → Direct GCP Resource Access
```

### Setup Script: `setup_workload_identity.sh`

The `setup_workload_identity.sh` script automates the entire setup process for both Vertex AI and Gemini Code Assist.

#### Quick Start

```shell
# Basic setup for your repository
./scripts/setup_workload_identity.sh --repo OWNER/REPO

# Example
./scripts/setup_workload_identity.sh --repo google/my-repo
```

#### Prerequisites

**Required Tools:**

- A Google Cloud Project with billing enabled.
- The [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`).
- A Bash shell.

**Required IAM Permissions:**

Your user account needs these permissions in the target GCP project to run the script:

- `resourcemanager.projects.setIamPolicy`
- `iam.workloadIdentityPools.create`
- `iam.workloadIdentityPools.update`
- `serviceusage.services.enable`

#### Usage

**Command Line Options:**

| Option                             | Description                                    | Example                    |
| ---------------------------------- | ---------------------------------------------- | -------------------------- |
| `--repo OWNER/REPO`                | **Required**: GitHub repository                | `--repo google/my-repo`    |
| `--project GOOGLE_CLOUD_PROJECT`   | GCP project ID (auto-detected if not provided) | `--project my-gcp-project` |
| `--location GOOGLE_CLOUD_LOCATION` | GCP project Location (defaults to 'global')    | `--location us-east1`      |
| `--pool-name NAME`                 | Custom pool name (default: `github`)           | `--pool-name my-pool`      |
| `--help`                           | Show help message                              |                            |

#### What the Script Does

1.  **Creates Workload Identity Pool**: A shared resource (named `github` by default).
2.  **Creates Workload Identity Provider**: Unique per repository, linked to the pool.
3.  **Grants Permissions**: Assigns IAM roles for observability and AI services.
4.  **Outputs Configuration**: Prints the GitHub Actions variables needed for your workflow.

#### Automatic Permissions

The script automatically grants these essential IAM roles:

- **`roles/logging.logWriter`**: To write logs to Cloud Logging.
- **`roles/monitoring.metricWriter`**: To write metrics to Cloud Monitoring.
- **`roles/cloudtrace.agent`**: To send traces to Cloud Trace.
- **`roles/aiplatform.user`**: To make inference calls to Vertex AI.
- **`roles/cloudaicompanion.user`**: To make inference calls using Gemini Code Assist.

### Connecting to Vertex AI

This is the standard method for authenticating directly with the Vertex AI API using your GCP project's identity.

#### Prerequisites

- A Google Cloud project with the **Vertex AI API** enabled.

#### GitHub Configuration

After running the `setup_workload_identity.sh` script, add the following variables to your repository's **Settings > Secrets and variables > Actions**:

| Variable Name               | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `GCP_WIF_PROVIDER`          | The resource name of the Workload Identity Provider. |
| `GOOGLE_CLOUD_PROJECT`      | Your Google Cloud project ID.                        |
| `GOOGLE_CLOUD_LOCATION`     | Your Google Cloud project Location.                  |
| `GOOGLE_GENAI_USE_VERTEXAI` | Set to `true` to authenticate using Vertex AI.       |
| `OTLP_GOOGLE_CLOUD_PROJECT` | Your Google Cloud project ID for observability.      |

#### Workflow Configuration Example

```yaml
- uses: google-github-actions/run-gemini-cli@main
  with:
    prompt: "Explain this code"
  env:
    GCP_WIF_PROVIDER: ${{ vars.GCP_WIF_PROVIDER }}
    OTLP_GOOGLE_CLOUD_PROJECT: ${{ vars.OTLP_GOOGLE_CLOUD_PROJECT }}
    GOOGLE_CLOUD_PROJECT: ${{ vars.GOOGLE_CLOUD_PROJECT }}
    GOOGLE_CLOUD_LOCATION: ${{ vars.GOOGLE_CLOUD_LOCATION }}
    GOOGLE_GENAI_USE_VERTEXAI: 'true'
```

### Connecting to Gemini Code Assist

If you have a **Gemini Code Assist** subscription, you can configure the action to use it for authentication.

#### Prerequisites

- A Google Cloud project with an active Gemini Code Assist subscription.

#### GitHub Configuration

After running the `setup_workload_identity.sh` script, add the following variables to your repository's **Settings > Secrets and variables > Actions**:

| Variable Name               | Description                                             |
| --------------------------- | ------------------------------------------------------- |
| `GCP_WIF_PROVIDER`          | The resource name of the Workload Identity Provider.    |
| `GOOGLE_CLOUD_PROJECT`      | Your Google Cloud project ID.                           |
| `SERVICE_ACCOUNT_EMAIL`     | The email of the service account for Code Assist.       |
| `GOOGLE_GENAI_USE_GCA`      | Set to `true` to authenticate using Gemini Code Assist. |
| `OTLP_GOOGLE_CLOUD_PROJECT` | Your Google Cloud project ID for observability.         |

#### Workflow Configuration Example

```yaml
- uses: google-github-actions/run-gemini-cli@main
  with:
    prompt: "Explain this code"
  env:
    GCP_WIF_PROVIDER: ${{ vars.GCP_WIF_PROVIDER }}
    OTLP_GOOGLE_CLOUD_PROJECT: ${{ vars.OTLP_GOOGLE_CLOUD_PROJECT }}
    GOOGLE_CLOUD_PROJECT: ${{ vars.GOOGLE_CLOUD_PROJECT }}
    SERVICE_ACCOUNT_EMAIL: ${{ vars.SERVICE_ACCOUNT_EMAIL }}
    GOOGLE_GENAI_USE_GCA: 'true'
```

## Additional Resources

- [Google Cloud Direct Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [google-github-actions/auth Documentation](https://github.com/google-github-actions/auth)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
