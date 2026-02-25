import { execSync, spawn } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import * as os from 'node:os';
import { env } from 'node:process';

export class TestRig {
  testDir: string;
  homeDir: string;
  telemetryLog: string;
  lastRunStdout: string = '';
  lastRunStderr: string = '';
  mcpServers: Record<string, any> = {};

  constructor(testName: string) {
    const sanitizedName = testName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.testDir = join(os.tmpdir(), 'gemini-evals', sanitizedName);
    this.homeDir = join(os.tmpdir(), 'gemini-evals', sanitizedName + '-home');

    mkdirSync(this.testDir, { recursive: true });
    mkdirSync(this.homeDir, { recursive: true });

    this.telemetryLog = join(this.homeDir, 'telemetry.log');
    this._setupSettings();
  }

  private _setupSettings() {
    const settings = {
      general: { disableAutoUpdate: true, previewFeatures: false },
      telemetry: { enabled: true, target: 'local', outfile: this.telemetryLog },
      security: {
        auth: { selectedType: 'gemini-api-key' },
        folderTrust: { enabled: false },
      },
      model: { name: env['GEMINI_MODEL'] || 'gemini-2.5-pro' },
      mcpServers: this.mcpServers,
      tools: {
        core: [
          'run_shell_command',
          'read_file',
          'list_directory',
          'glob',
          'grep',
          'edit',
          'write_file',
          'replace',
        ],
      },
    };

    const projectGeminiDir = join(this.testDir, '.gemini');
    const userGeminiDir = join(this.homeDir, '.gemini');
    mkdirSync(projectGeminiDir, { recursive: true });
    mkdirSync(userGeminiDir, { recursive: true });

    // Proactively create chats directory to avoid ENOENT errors
    const sanitizedName = basename(this.testDir);
    const chatsDir = join(userGeminiDir, 'tmp', sanitizedName, 'chats');
    mkdirSync(chatsDir, { recursive: true });

    writeFileSync(
      join(projectGeminiDir, 'settings.json'),
      JSON.stringify(settings, null, 2),
    );
    writeFileSync(
      join(userGeminiDir, 'settings.json'),
      JSON.stringify(settings, null, 2),
    );
  }

  setupMockMcp() {
    const mockServerPath = realpathSync(join(__dirname, 'mock-mcp-server.ts'));
    this.mcpServers['github'] = {
      command: 'npx',
      args: ['tsx', mockServerPath],
      trust: true,
    };
    this._setupSettings(); // Re-write with MCP config
  }

  createFile(path: string, content: string) {
    const fullPath = join(this.testDir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  readFile(path: string): string {
    return readFileSync(join(this.testDir, path), 'utf-8');
  }

  private _getCleanEnv(
    extraEnv?: Record<string, string>,
  ): Record<string, string | undefined> {
    const cleanEnv: Record<string, string | undefined> = { ...process.env };

    for (const key of Object.keys(cleanEnv)) {
      if (
        (key.startsWith('GEMINI_') || key.startsWith('GOOGLE_GEMINI_')) &&
        key !== 'GEMINI_API_KEY' &&
        key !== 'GOOGLE_API_KEY' &&
        key !== 'GEMINI_MODEL' &&
        key !== 'GEMINI_DEBUG' &&
        key !== 'GEMINI_CLI_TEST_VAR' &&
        !key.startsWith('GEMINI_CLI_ACTIVITY_LOG')
      ) {
        delete cleanEnv[key];
      }
    }

    return {
      ...cleanEnv,
      GEMINI_CLI_HOME: this.homeDir,
      ...extraEnv,
    };
  }

  async run(
    args: string[],
    extraEnv?: Record<string, string>,
  ): Promise<string> {
    const runArgs = [...args];
    const isSubcommand = args.length > 0 && !args[0].startsWith('-');

    if (!isSubcommand) {
      if (Object.keys(this.mcpServers).length > 0) {
        runArgs.push(
          '--allowed-mcp-server-names',
          Object.keys(this.mcpServers).join(','),
        );
      }
      runArgs.push('--allowed-tools', 'run_shell_command');
    }

    return new Promise((resolve, reject) => {
      const child = spawn('gemini', runArgs, {
        cwd: this.testDir,
        env: this._getCleanEnv(extraEnv),
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => (stdout += data));
      child.stderr.on('data', (data) => (stderr += data));

      child.on('close', (code) => {
        this.lastRunStdout = stdout;
        this.lastRunStderr = stderr;
        if (code === 0) resolve(stdout);
        else reject(new Error(`Exit ${code}: ${stderr}`));
      });
    });
  }

  git(args: string[]) {
    return execSync(`git ${args.join(' ')}`, {
      cwd: this.testDir,
      encoding: 'utf-8',
    });
  }

  initGit() {
    this.git(['init']);
    this.git(['config', 'user.email', 'test@example.com']);
    this.git(['config', 'user.name', 'Test User']);
  }

  readToolLogs() {
    if (!existsSync(this.telemetryLog)) return [];
    const content = readFileSync(this.telemetryLog, 'utf-8');
    return content
      .split(/(?<=})\s*(?={)/)
      .map((obj) => {
        try {
          return JSON.parse(obj.trim());
        } catch {
          return null;
        }
      })
      .filter((o) => o?.attributes?.['event.name'] === 'gemini_cli.tool_call')
      .map((o) => ({
        name: o.attributes.function_name,
        args: o.attributes.function_args,
        success: o.attributes.success,
        duration_ms: o.attributes.duration_ms,
      }));
  }

  cleanup() {
    if (env['KEEP_OUTPUT'] !== 'true') {
      rmSync(this.testDir, { recursive: true, force: true });
      rmSync(this.homeDir, { recursive: true, force: true });
    }
  }
}
