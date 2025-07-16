import path from 'path';
import fs from 'fs';
import net from 'net';
import os from 'os';
import { execSync } from 'child_process';
import crypto from 'node:crypto';

// Use the current working directory (user's project) instead of the action's directory
const projectRoot = process.cwd();
const projectHash = crypto
  .createHash('sha256')
  .update(projectRoot)
  .digest('hex');

// User-level .gemini directory in home
const USER_GEMINI_DIR = path.join(os.homedir(), '.gemini');
// Project-level .gemini directory in the workspace
const WORKSPACE_GEMINI_DIR = path.join(projectRoot, '.gemini');

// Telemetry artifacts are stored in a hashed directory under the user's ~/.gemini/tmp
export const OTEL_DIR = path.join(USER_GEMINI_DIR, 'tmp', projectHash, 'otel');
export const BIN_DIR = path.join(OTEL_DIR, 'bin');

// For GitHub Actions, we'll try both locations: user home first, then project
export const USER_SETTINGS_FILE = path.join(USER_GEMINI_DIR, 'settings.json');
export const WORKSPACE_SETTINGS_FILE = path.join(WORKSPACE_GEMINI_DIR, 'settings.json');

export function getJson(url) {
  const tmpFile = path.join(
    os.tmpdir(),
    `gemini-cli-releases-${Date.now()}.json`,
  );
  try {
    execSync(
      `curl -sL -H "User-Agent: gemini-cli-dev-script" -o "${tmpFile}" "${url}"`,
      { stdio: 'pipe' },
    );
    const content = fs.readFileSync(tmpFile, 'utf-8');
    
    if (!content || content.trim() === '') {
      throw new Error(`Empty response from ${url}`);
    }
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error(`Failed to parse JSON response from ${url}:`);
      console.error(`Content: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`);
      throw parseError;
    }
  } catch (e) {
    console.error(`Failed to fetch or parse JSON from ${url}`);
    throw e;
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
}

export function downloadFile(url, dest) {
  try {
    execSync(`curl -fL -sS -o "${dest}" "${url}"`, {
      stdio: 'pipe',
    });
    return dest;
  } catch (e) {
    console.error(`Failed to download file from ${url}`);
    throw e;
  }
}

export function findFile(startPath, filter) {
  if (!fs.existsSync(startPath)) {
    return null;
  }
  const files = fs.readdirSync(startPath);
  for (const file of files) {
    const filename = path.join(startPath, file);
    const stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      const result = findFile(filename, filter);
      if (result) return result;
    }
    else if (filter(file)) {
      return filename;
    }
  }
  return null;
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function readJsonFile(filePath) {
  if (!fileExists(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error parsing JSON from ${filePath}: ${e.message}`);
    return {};
  }
}

export function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function waitForPort(port, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const tryConnect = () => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', (_) => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for port ${port} to open.`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      socket.connect(port, 'localhost');
    };
    tryConnect();
  });
}

export async function ensureBinary(
  executableName,
  repo,
  assetNameCallback,
  binaryNameInArchive,
) {
  const executablePath = path.join(BIN_DIR, executableName);
  if (fileExists(executablePath)) {
    console.log(`✅ ${executableName} already exists at ${executablePath}`);
    return executablePath;
  }

  console.log(`🔍 ${executableName} not found. Downloading from ${repo}...`);

  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const arch = process.arch === 'x64' ? 'amd64' : process.arch;
  const ext = platform === 'windows' ? 'zip' : 'tar.gz';

  console.log(`🔍 Getting latest release for ${repo}...`);
  const release = getJson(`https://api.github.com/repos/${repo}/releases/latest`);
  
  if (!release || !release.tag_name) {
    throw new Error(
      `Could not get latest release information for ${repo}. Release data: ${JSON.stringify(release)}`,
    );
  }
  
  const version = release.tag_name.startsWith('v')
    ? release.tag_name.substring(1)
    : release.tag_name;
  const assetName = assetNameCallback(version, platform, arch, ext);
  
  if (!release.assets || !Array.isArray(release.assets)) {
    throw new Error(
      `Release ${release.tag_name} for ${repo} has no assets. Assets: ${JSON.stringify(release.assets)}`,
    );
  }
  
  const asset = release.assets.find((a) => a && a.name === assetName);
  if (!asset) {
    const availableAssets = release.assets.map(a => a.name).join(', ');
    throw new Error(
      `Could not find asset "${assetName}" for ${repo} (version ${version}) on platform ${platform}/${arch}. Available assets: ${availableAssets}`,
    );
  }

  const downloadUrl = asset.browser_download_url;
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gemini-cli-telemetry-'),
  );
  const archivePath = path.join(tmpDir, asset.name);

  try {
    console.log(`⬇️  Downloading ${asset.name}...`);
    downloadFile(downloadUrl, archivePath);
    console.log(`📦 Extracting ${asset.name}...`);

    const actualExt = asset.name.endsWith('.zip') ? 'zip' : 'tar.gz';

    if (actualExt === 'zip') {
      execSync(`unzip -o "${archivePath}" -d "${tmpDir}"`, { stdio: 'pipe' });
    } else {
      execSync(`tar -xzf "${archivePath}" -C "${tmpDir}"`, { stdio: 'pipe' });
    }

    const nameToFind = binaryNameInArchive || executableName;
    const foundBinaryPath = findFile(tmpDir, (file) => {
      if (platform === 'windows') {
        return file === `${nameToFind}.exe`;
      }
      return file === nameToFind;
    });

    if (!foundBinaryPath) {
      const contents = fs.readdirSync(tmpDir).join(', ');
      throw new Error(
        `Could not find binary "${nameToFind}" in extracted archive at ${tmpDir}. Contents: ${contents}`,
      );
    }

    fs.renameSync(foundBinaryPath, executablePath);

    if (platform !== 'windows') {
      fs.chmodSync(executablePath, '755');
    }

    console.log(`✅ ${executableName} installed at ${executablePath}`);
    return executablePath;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
  }
}

export function registerCleanup(
  getProcesses,
  getLogFileDescriptors,
) {
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    console.log('\n👋 Shutting down...');

    const processes = getProcesses ? getProcesses() : [];
    processes.forEach((proc) => {
      if (proc && proc.pid) {
        const name = path.basename(proc.spawnfile);
        try {
          console.log(`🛑 Stopping ${name} (PID: ${proc.pid})...`);
          process.kill(proc.pid, 'SIGTERM');
          console.log(`✅ ${name} stopped.`);
        } catch (e) {
          if (e.code !== 'ESRCH') {
            console.error(`Error stopping ${name}: ${e.message}`);
          }
        }
      }
    });

    const logFileDescriptors = getLogFileDescriptors
      ? getLogFileDescriptors()
      : [];
    logFileDescriptors.forEach((fd) => {
      if (fd) {
        try {
          fs.closeSync(fd);
        } catch (_) {
          /* no-op */
        }
      }
    });
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
    process.exit(1);
  });
}
