# Observability with OpenTelemetry

This action can be configured to send telemetry data (traces, metrics, and logs) to your own Google Cloud project. This allows you to monitor the performance and behavior of the Gemini CLI within your workflows, providing valuable insights for debugging and optimization.

The action uses its own built-in telemetry system that ensures consistent and reliable telemetry collection across all workflows.

- [Observability with OpenTelemetry](#observability-with-opentelemetry)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Configuration](#configuration)
  - [Viewing Telemetry Data](#viewing-telemetry-data)
  - [Collector Configuration](#collector-configuration)
  - [Example](#example)
  - [Disabling](#disabling)
  - [Troubleshooting](#troubleshooting)

## Overview

The Gemini CLI Action integrates OpenTelemetry to provide comprehensive observability for your workflows. This includes:

- **Metrics**: Monitor performance indicators and usage statistics
- **Logs**: Capture detailed information for debugging and analysis
- **Traces**: Track the execution flow and timing of operations

## Prerequisites

Before enabling observability, ensure you have:

- A Google Cloud project with billing enabled
- Completed authentication setup (see [Authentication documentation](./authentication.md))
- The following APIs enabled in your GCP project:
  - Cloud Monitoring API
  - Cloud Logging API
  - Cloud Trace API

## Setup

To enable observability, you must first configure authentication to Google Cloud.
The setup script provided in the [Authentication guide](./authentication.md) will
automatically provision the necessary IAM permissions for observability.

Please follow the instructions in the
[**Authentication documentation**](./authentication.md) to set up your
environment.

## Configuration

After running the setup script, configure your GitHub Actions workflow with the provided values:

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    gcp_workload_identity_provider: '${{ vars.GCP_WIF_PROVIDER }}'
    gcp_project_id: '${{ vars.GOOGLE_CLOUD_PROJECT }}'
    gemini_api_key: '${{ secrets.GEMINI_API_KEY }}'
    # Enable telemetry in settings
    settings: |-
      {
        "telemetry": {
          "enabled": true,
          "target": "gcp"
        }
      }
    # ... other inputs ...
```

**Important**: To enable telemetry, you must include the `settings` configuration as shown above. This tells the Gemini CLI to:
- Enable telemetry collection
- Send data to the local OpenTelemetry collector which forwards to your GCP project

## Viewing Telemetry Data

Once configured, you can view your telemetry data in the Google Cloud Console:

- **Traces**: [Cloud Trace Console](https://console.cloud.google.com/traces)
- **Metrics**: [Cloud Monitoring Console](https://console.cloud.google.com/monitoring)
- **Logs**: [Cloud Logging Console](https://console.cloud.google.com/logs)

## Collector Configuration

The action automatically handles the setup of the OpenTelemetry (OTel) collector. This includes generating the necessary Google Cloud configuration, setting the correct file permissions for credentials, and running the collector in a Docker container. The collector is configured to use only the `googlecloud` exporter, ensuring telemetry is sent directly to your Google Cloud project.

## Example

```yaml
jobs:
  review:
    runs-on: 'ubuntu-latest'
    steps:
      - uses: 'google-github-actions/run-gemini-cli@v0'
        with:
          gcp_workload_identity_provider: '${{ vars.GCP_WIF_PROVIDER }}'
          gcp_service_account: '${{ vars.SERVICE_ACCOUNT_EMAIL }}'
          gcp_project_id: '${{ vars.GOOGLE_CLOUD_PROJECT }}'
          settings: |-
            {
              "telemetry": {
                "enabled": true,
                "target": "gcp"
              }
            }
          prompt: |-
            Review this pull request
```

## Disabling

If you prefer to disable OpenTelemetry, you can explicitly opt out by setting `enabled: false` in your settings:

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    gcp_workload_identity_provider: '${{ vars.GCP_WIF_PROVIDER }}'
    gcp_project_id: '${{ vars.GOOGLE_CLOUD_PROJECT }}'
    gemini_api_key: '${{ secrets.GEMINI_API_KEY }}'
    # Disable telemetry in settings
    settings: |-
      {
        "telemetry": {
          "enabled": false,
          "target": "gcp"
        }
      }
    # ... other inputs ...
```

Alternatively, you can omit the `telemetry` settings entirely, as telemetry is disabled by default:

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    gcp_workload_identity_provider: '${{ vars.GCP_WIF_PROVIDER }}'
    gcp_project_id: '${{ vars.GOOGLE_CLOUD_PROJECT }}'
    gemini_api_key: '${{ secrets.GEMINI_API_KEY }}'
    settings: |-
      {
        # ... other settings ...
      }
```

## Troubleshooting

**Telemetry not appearing in Google Cloud Console:**
1. Verify that authentication is properly configured
2. Check that the required APIs are enabled in your GCP project
3. Ensure the service account has the necessary IAM permissions
4. Confirm telemetry is enabled in your workflow settings

**Permission errors:**
- Verify your service account has these roles:
  - `roles/logging.logWriter`
  - `roles/monitoring.editor`
  - `roles/cloudtrace.agent`

For additional troubleshooting guidance, see the [Authentication documentation](./authentication.md).
