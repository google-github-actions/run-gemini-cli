#!/bin/bash
set -euo pipefail

# If the telemetry log doesn't exist or is empty, do nothing.
if [[ ! -s ".gemini/telemetry.log" ]]; then
  echo "No telemetry log found, skipping upload."
  exit 0
fi

# Generate the real config file from the template
sed -e "s#OTLP_GOOGLE_CLOUD_PROJECT#${OTLP_GOOGLE_CLOUD_PROJECT}#g" \
    -e "s#GITHUB_REPOSITORY_PLACEHOLDER#${GITHUB_REPOSITORY}#g" \
    -e "s#GITHUB_RUN_ID_PLACEHOLDER#${GITHUB_RUN_ID}#g" \
  "${GITHUB_ACTION_PATH}/scripts/collector-gcp.yaml.template" > ".gemini/collector-gcp.yaml"

# Ensure credentials file has the right permissions
chmod 444 "$GOOGLE_APPLICATION_CREDENTIALS"

# Run the collector in the background with a known name
docker run --rm --name gemini-telemetry-collector --network host \
  -v "${GITHUB_WORKSPACE}:/github/workspace" \
  -e "GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS/$GITHUB_WORKSPACE//github/workspace}" \
  -w "/github/workspace" \
  otel/opentelemetry-collector-contrib:0.108.0 \
  --config /github/workspace/.gemini/collector-gcp.yaml &

# Wait for the collector to start up
echo "Waiting for collector to initialize..."
sleep 10

# Monitor the queue until it's empty or we time out
echo "Monitoring exporter queue..."
ATTEMPTS=0
MAX_ATTEMPTS=12 # 12 * 5s = 60s timeout
while true; do
    # Use -f to fail silently if the server isn't ready yet
    # Filter out the prometheus help/type comments before grabbing the value
    QUEUE_SIZE=$(curl -sf http://localhost:8888/metrics | grep otelcol_exporter_queue_size | grep -v '^#' | awk '{print $2}' || echo "-1")

    if [ "$QUEUE_SIZE" == "0" ]; then
        echo "Exporter queue is empty, all data processed."
        break
    fi

    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
        echo "::warning::Timed out waiting for exporter queue to empty. Proceeding with shutdown."
        break
    fi

    echo "Queue size: $QUEUE_SIZE, waiting..."
    sleep 5
    ATTEMPTS=$((ATTEMPTS + 1))
done

# Gracefully shut down the collector
echo "Stopping collector..."
docker stop gemini-telemetry-collector
echo "Collector stopped."
