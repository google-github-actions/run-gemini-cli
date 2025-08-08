# Configuring Gemini CLI Workflows

This guide covers how to customize and configure Gemini CLI workflows to meet your specific needs.

- [Configuring Gemini CLI Workflows](#configuring-gemini-cli-workflows)
  - [How to Configure Gemini CLI](#how-to-configure-gemini-cli)
    - [Key Settings](#key-settings)
      - [Conversation Length (`maxSessionTurns`)](#conversation-length-maxsessionturns)
      - [Allowlist Tools (`coreTools`)](#allowlist-tools-coretools)
      - [MCP Servers (`mcpServers`)](#mcp-servers-mcpservers)
    - [Custom Context and Guidance (`GEMINI.md`)](#custom-context-and-guidance-geminimd)
  - [GitHub Actions Workflow Settings](#github-actions-workflow-settings)
    - [Setting Timeouts](#setting-timeouts)
    - [Required Permissions](#required-permissions)

## How to Configure Gemini CLI

Gemini CLI workflows are highly configurable. You can adjust their behavior by editing the corresponding `.yml` files in your repository.

Gemini CLI supports many settings that control how it operates. For a complete list, see the [Gemini CLI documentation](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/configuration.md#available-settings-in-settingsjson).

### Key Settings

#### Conversation Length (`maxSessionTurns`)

This setting controls the maximum number of conversational turns (messages exchanged) allowed during a workflow run.

**Default values by workflow:**

| Workflow                             | Default `maxSessionTurns` |
| ------------------------------------ | ------------------------- |
| [Issue Triage](./issue-triage)       | 25                        |
| [Pull Request Review](./pr-review)   | 20                        |
| [Gemini CLI Assistant](./gemini-cli) | 50                        |

**How to override:**

Add the following to your workflow YAML file to set a custom value:

```yaml
with:
  settings: |-
    {
      "maxSessionTurns": 10
    }
```

#### Allowlist Tools (`coreTools`)

Allows you to specify a list of [built-in tools] that should be made available to the model. You can also use this to allowlist commands for shell tool.

**Default:** All tools available for use by Gemini CLI.

**How to configure:**

Add the following to your workflow YAML file to specify core tools:

```yaml
with:
  settings: |-
    {
      "coreTools": [
        "read_file"
        "run_shell_command(echo)",
        "run_shell_command(gh label list)"
      ]
    }
```

#### MCP Servers (`mcpServers`)

Configures connections to one or more Model Context Protocol (MCP) servers for discovering and using custom tools. This allows you to extend Gemini CLI GitHub Action with additional capabilities.

**Default:** Empty

**Example:**

```yaml
with:
  settings: |-
    {
      "mcpServers": {
        "github": {
          "command": "docker",
          "args": [
            "run",
            "-i",
            "--rm",
            "-e",
            "GITHUB_PERSONAL_ACCESS_TOKEN",
            "ghcr.io/github/github-mcp-server"
          ],
          "env": {
            "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
          }
        }
      }
    }
```

### Custom Context and Guidance (`GEMINI.md`)

To provide Gemini CLI with custom instructions—such as coding conventions, architectural patterns, or other guidance—add a `GEMINI.md` file to the root of your repository. Gemini CLI will use the content of this file to inform its responses.

## GitHub Actions Workflow Settings

### Setting Timeouts

You can control how long Gemini CLI runs by using either the `timeout-minutes` field in your workflow YAML, or by specifying a timeout in the `settings` input.

### Required Permissions

Only users with the following roles can trigger the workflow:

- Repository Owner (`OWNER`)
- Repository Member (`MEMBER`)
- Repository Collaborator (`COLLABORATOR`)

[built-in tools]: https://github.com/google-gemini/gemini-cli/blob/main/docs/core/tools-api.md#built-in-tools
