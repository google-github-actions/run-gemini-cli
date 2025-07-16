import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import {
  OTEL_DIR,
  BIN_DIR,
  fileExists,
  waitForPort,
  ensureBinary,
} from './telemetry_utils.js';

const OTEL_CONFIG_FILE = path.join(OTEL_DIR, 'collector-gcp.yaml');
const OTEL_LOG_FILE = path.join(OTEL_DIR, 'collector-gcp.log');

const getOtelConfigContent = (projectId) => `
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "localhost:4317"
processors:
  batch:
    timeout: 1s
exporters:
  googlecloud:
    project: "${projectId}"
    metric:
      prefix: "custom.googleapis.com/gemini_cli"
    log:
      default_log_name: "gemini_cli"
  debug:
    verbosity: detailed
    sampling_initial: 2
    sampling_thereafter: 500
service:
  telemetry:
    logs:
      level: "debug"
    metrics:
      level: "none"
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [googlecloud, debug]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [googlecloud, debug]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [googlecloud, debug]
`;

async function main() {
  console.log('✨ Starting OpenTelemetry Collector for Google Cloud ✨');

  const projectId = process.env.OTLP_GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    console.error('🛑 Error: OTLP_GOOGLE_CLOUD_PROJECT environment variable is required.');
    process.exit(1);
  }
  console.log(`✅ Using Google Cloud Project: ${projectId}`);

  console.log('\n📋 To enable telemetry, include these settings in your settings_json:');
  console.log(`{`);
  console.log(`  "telemetry": {`);
  console.log(`    "enabled": true,`);
  console.log(`    "target": "gcp"`);
  console.log(`  },`);
  console.log(`  "sandbox": false`);
  console.log(`}`);

  if (!fileExists(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

  const otelcolPath = await ensureBinary(
    'otelcol-contrib',
    'open-telemetry/opentelemetry-collector-releases',
    (version, platform, arch, ext) =>
      `otelcol-contrib_${version}_${platform}_${arch}.${ext}`,
    'otelcol-contrib',
  ).catch((e) => {
    console.error(`🛑 Error getting otelcol-contrib: ${e.message}`);
    return null;
  });
  if (!otelcolPath) process.exit(1);

  console.log('🧹 Cleaning up old processes and logs...');
  try {
    execSync('pkill -f "otelcol-contrib"');
    console.log('✅ Stopped existing collector process.');
  } catch (_e) {
    /* no-op */
  }
  try {
    fs.unlinkSync(OTEL_LOG_FILE);
    console.log('✅ Deleted old collector log.');
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
  }

  if (!fileExists(OTEL_DIR)) fs.mkdirSync(OTEL_DIR, { recursive: true });
  fs.writeFileSync(OTEL_CONFIG_FILE, getOtelConfigContent(projectId));
  console.log(`📄 Wrote collector config to ${OTEL_CONFIG_FILE}`);

  console.log(`🚀 Starting collector... Logs: ${OTEL_LOG_FILE}`);
  const collectorLogFd = fs.openSync(OTEL_LOG_FILE, 'a');
  
  const collectorProcess = spawn(otelcolPath, ['--config', OTEL_CONFIG_FILE], {
    stdio: ['ignore', collectorLogFd, collectorLogFd],
    env: { ...process.env },
    detached: true,
  });
  
  collectorProcess.unref();

  console.log(`⏳ Waiting for collector to start (PID: ${collectorProcess.pid})...`);

  try {
    await waitForPort(4317);
    console.log(`✅ Collector started successfully on port 4317.`);
    console.log(`� Collector logs: ${OTEL_LOG_FILE}`);
    console.log(`\n📊 After Gemini CLI runs, view telemetry data at:`);
    console.log(`   📝 Logs: https://console.cloud.google.com/logs/query;query=logName%3D%22projects%2F${projectId}%2Flogs%2Fgemini_cli%22?project=${projectId}`);
    console.log(`   📈 Metrics: https://console.cloud.google.com/monitoring/metrics-explorer?project=${projectId}`);
    console.log(`   🔍 Traces: https://console.cloud.google.com/traces/list?project=${projectId}`);
    
    process.exit(0);
  } catch (err) {
    console.error(`🛑 Error: Collector failed to start on port 4317.`);
    console.error(err.message);
    if (collectorProcess && collectorProcess.pid) {
      process.kill(collectorProcess.pid, 'SIGKILL');
    }
    if (fileExists(OTEL_LOG_FILE)) {
      console.error('📄 Collector Log Output:');
      console.error(fs.readFileSync(OTEL_LOG_FILE, 'utf-8'));
    }
    process.exit(1);
  }
}

main();
