# Gemini CLI Assistant

In this guide you will learn how to use the Gemini CLI Assistant via GitHub Actions. It serves as an on-demand collaborator you can quickly delegate work to, invoked directly in GitHub Pull Request and Issue comments to perform a wide range of tasks—from code analysis and modifications to project management. When you invoke the workflow via `@gemini-cli`, it uses a customizable set of tools to understand the context, execute your request, and respond within the same thread.

- [Gemini CLI Assistant](#gemini-cli-assistant)
  - [Overview](#overview)
  - [Features](#features)
  - [Setup](#setup)
    - [Prerequisites](#prerequisites)
    - [Setup Methods](#setup-methods)
  - [Dependencies](#dependencies)
  - [Usage](#usage)
    - [Supported Triggers](#supported-triggers)
    - [How to Invoke the Gemini CLI Workflow](#how-to-invoke-the-gemini-cli-workflow)
  - [Interaction Flow](#interaction-flow)
  - [Configuration](#configuration)
  - [Examples](#examples)
    - [Asking a Question](#asking-a-question)
    - [Requesting a Code Change](#requesting-a-code-change)
    - [Summarizing an Issue](#summarizing-an-issue)

## Overview

Unlike specialized Gemini CLI workflows for [pull request reviews](../pr-review) or [issue triage](../issue-triage), the Gemini CLI Assistant is designed to handle a broad variety of requests, from answering questions about the code to performing complex code modifications, as demonstrated further in this document.

## Features

- **Conversational Interface**: You can interact with the Gemini AI assistant directly in GitHub Issue and PR comments.
- **Repository Interaction**: The Gemini CLI can read files, view diffs in Pull Requests, and inspect Issue details.
- **Code Modification**: The Gemini CLI is capable of writing to files, committing changes, and pushing to the branch.
- **Customizable Toolset**: You can define exactly which shell commands and tools the Gemini AI is allowed to use.
- **Flexible Prompting**: You can tailor the Gemini CLI's role, instructions, and guidelines to fit your project's needs.

## Setup

For detailed setup instructions, including prerequisites and authentication, please refer to the main [Getting Started](../../../README.md#quick-start) section and [Authentication documentation](../../../docs/authentication.md).

### Prerequisites

Add the following entries to your `.gitignore` file to prevent Gemini CLI artifacts from being committed:

```gitignore
# gemini-cli settings
.gemini/

# GitHub App credentials
gha-creds-*.json
```

### Setup Methods

To use this workflow, you can utilize either of the following methods:
1. Run the `/setup-github` command in Gemini CLI on your terminal to set up workflows for your repository.
2. Copy the workflow files into your repository's `.github/workflows` directory:

```bash
mkdir -p .github/workflows
curl -o .github/workflows/gemini-dispatch.yml https://raw.githubusercontent.com/google-github-actions/run-gemini-cli/main/examples/workflows/gemini-dispatch/gemini-dispatch.yml
curl -o .github/workflows/gemini-invoke.yml https://raw.githubusercontent.com/google-github-actions/run-gemini-cli/main/examples/workflows/gemini-assistant/gemini-invoke.yml
```

> **Note:** The `gemini-dispatch.yml` workflow is designed to call multiple
> workflows. If you are only setting up `gemini-invoke.yml`, you should comment out or
> remove the other jobs in your copy of `gemini-dispatch.yml`.

## Dependencies

This workflow relies on the [gemini-dispatch.yml](../gemini-dispatch/gemini-dispatch.yml) workflow to route requests to the appropriate workflow.

## Usage

### Supported Triggers

The Gemini CLI Assistant workflow is triggered by new comments in:

- GitHub Pull Request reviews
- GitHub Pull Request review comments
- GitHub Issues

The Gemini CLI Assistant workflow is intentionally configured *not* to respond to comments containing `/review` or `/triage` to avoid conflicts with other dedicated workflows (such as [the Gemini CLI Pull Request workflow](../pr-review) or [the issue triage workflow](../issue-triage)).

### How to Invoke the Gemini CLI Workflow

To use the general GitHub CLI workflow, just mention `@gemini-cli` in a comment in a GitHub Pull Request or an Issue, followed by your request. For example:

```
@gemini-cli Please explain what the `main.go` file does.
```

```
@gemini-cli Refactor the `calculateTotal` function in `src/utils.js` to improve readability.
```

## Interaction Flow

The workflow follows a clear, multi-step process to handle requests:

```mermaid
flowchart TD
    subgraph "User Interaction"
        A[User posts comment with '@gemini-cli <request>']
        F{Approve plan?}
    end

    subgraph "Gemini CLI Workflow"
        B[Acknowledge Request]
        C[Checkout Code]
        D[Run Gemini]
        E{Is a plan required?}
        G[Post Plan for Approval]
        H[Execute Request]
        I{Request involves code changes?}
        J[Commit and Push Changes]
        K[Post Final Response]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E -- Yes --> G
    G --> F
    F -- Yes --> H
    F -- No --> K
    E -- No --> H
    H --> I
    I -- Yes --> J
    J --> K
    I -- No --> K
```

1.  **Acknowledge**: The action first posts a brief comment to let the user know the request has been received.
2.  **Plan (if needed)**: For requests that may involve code changes or complex actions, the AI will first create a step-by-step plan. It will post this plan as a comment and wait for the user to approve it by replying with `@gemini-cli plan#123 approved`. This ensures the user has full control before any changes are made.
3.  **Execute**: Once the plan is approved (or if no plan was needed), it runs the Gemini model, providing it with the user's request, repository context, and a set of tools.
4.  **Commit (if needed)**: If the AI uses tools to modify files, it will automatically commit and push the changes to the branch.
5.  **Respond**: The AI posts a final, comprehensive response as a comment on the issue or pull request.

## Configuration

The Gemini CLI assistant prompt is defined in the `gemini-invoke.toml` file. The action automatically copies this file from `.github/commands/` to `.gemini/commands/` during execution.

**To customize the assistant prompt:**

1. Copy the TOML file to your repository:
   ```bash
   mkdir -p .gemini/commands
   curl -o .gemini/commands/gemini-invoke.toml https://raw.githubusercontent.com/google-github-actions/run-gemini-cli/main/examples/workflows/gemini-assistant/gemini-invoke.toml
   ```

2. Edit `.gemini/commands/gemini-invoke.toml` to customize:
   - Change its persona or primary function
   - Add project-specific guidelines or context
   - Instruct it to format its output in a specific way
   - Modify security constraints or workflow steps

3. Commit the file to your repository:
   ```bash
   git add .gemini/commands/gemini-invoke.toml
   git commit -m "feat: customize Gemini assistant prompt"
   ```

The workflow will use your custom TOML file instead of the default one from the action.

For more details on workflow configuration, see the [Configuration Guide](../CONFIGURATION.md#custom-commands-toml-files).

## Examples

More Gemini CLI Assistant workflow examples:

### Asking a Question

```
@gemini-cli What is the purpose of the `telemetry.js` script?
```

### Requesting a Code Change

```
@gemini-cli In `package.json`, please add a new script called "test:ci" that runs `npm test`.
```

### Summarizing an Issue

```
@gemini-cli Can you summarize the main points of this issue thread for me?
```

[Google AI Studio]: https://aistudio.google.com/apikey
