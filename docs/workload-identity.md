# Direct Workload Identity Federation Setup for GitHub Actions

This guide covers setting up Google Cloud **Direct Workload Identity Federation** for GitHub repositories using the `scripts/setup_workload_identity.sh` script.

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

| Option | Description | Example |
|--------|-------------|---------|
| `--repo OWNER/REPO` | **Required**: GitHub repository | `--repo google/my-repo` |
| `--project GOOGLE_CLOUD_PROJECT` | GCP project ID (auto-detected if not provided) | `--project my-gcp-project` |
| `--location GOOGLE_CLOUD_LOCATION` | GCP project Location (defaults to 'global') | `--location us-east1` |
| `--pool-name NAME` | Custom pool name (default: `github`) | `--pool-name my-pool` |
| `--help` | Show help message | |

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

| Environment Variable Name         | Description                                      |
|-----------------------------------|--------------------------------------------------|
| `GCP_WIF_PROVIDER`                | Workload Identity Provider resource name         |
| `OTLP_GOOGLE_CLOUD_PROJECT`       | Your Google Cloud project ID                     |
| `GOOGLE_CLOUD_PROJECT`            | Your Google Cloud project ID                     |
| `GOOGLE_CLOUD_LOCATION`           | Your Google Cloud project Location               |

## Additional Resources

- [Google Cloud Direct Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [google-github-actions/auth Documentation](https://github.com/google-github-actions/auth)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
