# Observability with OpenTelemetry

This action can be configured to send telemetry data (traces, metrics, and logs) to your own Google Cloud project. This allows you to monitor the performance and behavior of the Gemini CLI within your workflows, providing valuable insights for debugging and optimization.

The action uses its own built-in telemetry system that ensures consistent and reliable telemetry collection across all workflows.

- [Observability with OpenTelemetry](#observability-with-opentelemetry)
  - [Required Inputs](#required-inputs)
  - [Setup: Obtaining Input Values](#setup-obtaining-input-values)
    - [Quick Setup](#quick-setup)
  - [Advanced Setup](#advanced-setup)
  - [GitHub Actions Configuration](#github-actions-configuration)
  - [Viewing Telemetry Data](#viewing-telemetry-data)
  - [Collector Configuration](#collector-configuration)
  - [Troubleshooting](#troubleshooting)


## Required Inputs

For a complete list of required inputs, their descriptions, and how to configure them, see [docs](../README.md#inputs).

When enabled, the action will automatically start an OpenTelemetry collector that forwards traces, metrics, and logs to your specified GCP project. You can then use Google Cloud's operations suite (formerly Stackdriver) to visualize and analyze this data.

When enabled, the action will automatically start an OpenTelemetry collector that forwards traces, metrics, and logs to your specified GCP project. You can then use Google Cloud's operations suite (formerly Stackdriver) to visualize and analyze this data.

## Setup: Obtaining Input Values

The recommended way to configure your Google Cloud project and get the values for the inputs above is to use the provided setup script. This script automates the creation of all necessary resources using **Direct Workload Identity Federation**, ensuring a secure, keyless authentication mechanism without intermediate service accounts.

For detailed setup instructions, see the [Workload Identity Federation documentation](./workload-identity.md).

### Quick Setup

> Note that setting up this Observability requires a Google Cloud account as well as Google Cloud CLI (install gcloud [here](https://cloud.google.com/sdk/docs/install))

```bash
./scripts/setup_workload_identity.sh --repo <OWNER/REPO> --project <PROJECT_ID>
```

-   `<OWNER/REPO>`: Your GitHub repository in the format `owner/repo`.
-   `<PROJECT_ID>`: Your Google Cloud `project_id`.

After the `setup_workload_identity.sh` script finishes running, it will output a link to where you can edit your repository variables. Click on that link and then add the variables output from the script into your GitHub "Repository variables".

Additionally, to complete the setup add your `GEMINI_API_KEY` as a secret - this is discussed in more detail in the `run-gemini-cli` [README](https://github.com/google-github-actions/run-gemini-cli?tab=readme-ov-file#getting-started).

## Advanced Setup

For advanced configuration options, manual setup instructions, troubleshooting, and security best practices, see the complete [Workload Identity Federation documentation](./workload-identity.md).

## GitHub Actions Configuration

After running the setup script, configure your GitHub Actions workflow with the provided values:

```yaml
- uses: google-github-actions/run-gemini-cli@v1
  with:
    gcp_workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
    gcp_project_id: ${{ vars.GOOGLE_CLOUD_PROJECT }}
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
    # Enable telemetry in settings
    settings: |
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
- Send data to the local OpenTelemetry collector (which forwards to GCP)
- Disable sandbox mode (required for telemetry)

## Viewing Telemetry Data

Once configured, you can view your telemetry data in the Google Cloud Console:

- **Traces**: [Cloud Trace Console](https://console.cloud.google.com/traces)
- **Metrics**: [Cloud Monitoring Console](https://console.cloud.google.com/monitoring)
- **Logs**: [Cloud Logging Console](https://console.cloud.google.com/logs)

## Collector Configuration

The action automatically handles the setup of the OpenTelemetry (OTel) collector. 
This includes generating the necessary Google Cloud configuration, setting the correct
file permissions for credentials, and running the collector in a Docker container. The
collector is configured to use only the `googlecloud` exporter, ensuring telemetry
is sent directly to your Google Cloud project. 

## Troubleshooting

If you encounter issues with observability setup, see the troubleshooting section in the [Workload Identity Federation documentation](./workload-identity.md#troubleshooting).
