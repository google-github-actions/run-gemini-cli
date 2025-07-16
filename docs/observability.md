# Observability with OpenTelemetry

This action can be configured to send telemetry data (traces, metrics, and logs) to your own Google Cloud project. This allows you to monitor the performance and behavior of the Gemini CLI within your workflows, providing valuable insights for debugging and optimization.

The action uses its own built-in telemetry system that ensures consistent and reliable telemetry collection across all workflows.

- [Observability with OpenTelemetry](#observability-with-opentelemetry)
  - [Required Environment Variables](#required-environment-variables)
  - [Setup: Obtaining Input Values](#setup-obtaining-input-values)
    - [Quick Setup](#quick-setup)
  - [Advanced Setup](#advanced-setup)
  - [GitHub Actions Configuration](#github-actions-configuration)
  - [Viewing Telemetry Data](#viewing-telemetry-data)
  - [Troubleshooting](#troubleshooting)


## Required Environment Variables

For a complete list of required environment variables, their descriptions, and how to configure them, see [Configuration](./configuration.md#environment-variables).

When enabled, the action will automatically start an OpenTelemetry collector that forwards traces, metrics, and logs to your specified GCP project. You can then use Google Cloud's operations suite (formerly Stackdriver) to visualize and analyze this data.

When enabled, the action will automatically start an OpenTelemetry collector that forwards traces, metrics, and logs to your specified GCP project. You can then use Google Cloud's operations suite (formerly Stackdriver) to visualize and analyze this data.

## Setup: Obtaining Input Values

The recommended way to configure your Google Cloud project and get the values for the inputs above is to use the provided setup script. This script automates the creation of all necessary resources using **Direct Workload Identity Federation**, ensuring a secure, keyless authentication mechanism without intermediate service accounts.

For detailed setup instructions, see the [Workload Identity Federation documentation](./workload-identity.md).

### Quick Setup

Run the following command from the root of this repository:

```bash
./scripts/setup_workload_identity.sh --repo <OWNER/REPO>
```

-   `<OWNER/REPO>`: Your GitHub repository in the format `owner/repo`.

After the script completes, it will output the values for the environment variables listed above. You must add these to your GitHub repository's variables (and GEMINI_API_KEY as a secret) to complete the setup.

## Advanced Setup

For advanced configuration options, manual setup instructions, troubleshooting, and security best practices, see the complete [Workload Identity Federation documentation](./workload-identity.md).

## GitHub Actions Configuration

After running the setup script, configure your GitHub Actions workflow with the provided values:

```yaml
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ vars.OTLP_GCP_WIF_PROVIDER }}
    project_id: ${{ vars.OTLP_GOOGLE_CLOUD_PROJECT }}


- uses: google-github-actions/run-gemini-cli@v1
  env:
    OTLP_GCP_WIF_PROVIDER: ${{ vars.OTLP_GCP_WIF_PROVIDER }}
    OTLP_GOOGLE_CLOUD_PROJECT: ${{ vars.OTLP_GOOGLE_CLOUD_PROJECT }}
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  with:
    # Enable telemetry in settings
    settings_json: |
      {
        "telemetry": {
          "enabled": true,
          "target": "gcp"
        },
        "sandbox": false
      }
    # ... other inputs ...
```

**Important**: To enable telemetry, you must include the `settings_json` configuration as shown above. This tells the Gemini CLI to:
- Enable telemetry collection
- Send data to the local OpenTelemetry collector (which forwards to GCP)
- Disable sandbox mode (required for telemetry)

## Viewing Telemetry Data

Once configured, you can view your telemetry data in the Google Cloud Console:

- **Traces**: [Cloud Trace Console](https://console.cloud.google.com/traces)
- **Metrics**: [Cloud Monitoring Console](https://console.cloud.google.com/monitoring)
- **Logs**: [Cloud Logging Console](https://console.cloud.google.com/logs)

## Troubleshooting

If you encounter issues with observability setup, see the troubleshooting section in the [Workload Identity Federation documentation](./workload-identity.md#troubleshooting).
