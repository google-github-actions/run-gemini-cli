# Awesome Workflows

Welcome to our collection of awesome community-contributed workflows! This page showcases creative and powerful implementations of the [Google Gemini CLI GitHub Action](https://github.com/google-github-actions/run-gemini-cli) created by the community.

**Want to add your workflow?** Check out the [submission guidelines](./README.md#share-your-workflow) in our main README.

> **⚠️ Security Notice**: Always review and understand any workflow before using it in your repository. Community-contributed workflows are provided as-is and have not been security audited. Verify the code, permissions, and any external dependencies before implementation.

- [Awesome Workflows](#awesome-workflows)
  - [Workflow Categories](#workflow-categories)
    - [🔍 Code Quality](#-code-quality)
    - [📋 Project Management](#-project-management)
    - [📝 Documentation](#-documentation)
    - [🛡️ Security](#️-security)
    - [🧪 Testing](#-testing)
    - [🚀 Deployment \& Release](#-deployment--release)
    - [🎯 Specialized Use Cases](#-specialized-use-cases)
  - [Featured Workflows](#featured-workflows)

## Workflow Categories

Browse workflows by category to find exactly what you're looking for.

### 🔍 Code Quality

Workflows that help maintain code quality, perform analysis, or enforce standards.

*No workflows yet. Be the first to contribute!*

### 📋 Project Management

Workflows that help manage GitHub issues, projects, or team collaboration.

### 1. Workflow to Enforce Contribution Guidelines in Pull Requests

**Repository:** [jasmeetsb/gemini-github-actions](https://github.com/jasmeetsb/gemini-github-actions)

**Description:** Automates validation of pull requests against your repository's CONTRIBUTING.md using the Google Gemini CLI. The workflow posts a single upserted PR comment indicating PASS/FAIL with a concise checklist of actionable items, and can optionally fail the job to enforce compliance.

**Key Features:**

- Reads and evaluates PR title, body, and diff against CONTRIBUTING.md
- Posts a single PR comment with a visible PASS/FAIL marker in Comment Title and details of compliance status in the comment body
- Optional enforcement: fail the workflow when violations are detected

**Setup Requirements:**

- Copy [.github/workflows/pr-contribution-guidelines-enforcement.yml](https://github.com/jasmeetsb/gemini-github-actions/blob/main/.github/workflows/pr-contribution-guidelines-enforcement.yml) to your .github/workflows/ folder.
- File: `CONTRIBUTING.md` at the repository root
- (Optional) Repository variable `FAIL_ON_GUIDELINE_VIOLATIONS=true` to fail the workflow on violations

**Example Usage:**

- Define contribution guidelines in CONTRIBUTING.md file
- Open a new PR or update an existing PR, which would then trigger the workflow
- Workflow will validate the PR against the contribution guidelines and add a comment in the PR with PASS/FAIL status and details of guideline compliance and non-compliance

  **OR**

- Add following comment in an existing PR **"/validate-contribution"** to trigger the workflow

**Workflow File:**

- Example location in this repo: [.github/workflows/pr-contribution-guidelines-enforcement.yml](https://github.com/jasmeetsb/gemini-github-actions/blob/main/.github/workflows/pr-contribution-guidelines-enforcement.yml)
- Typical usage in a consumer repo: `.github/workflows/pr-contribution-guidelines-enforcement.yml` (copy the file and adjust settings/secrets as needed)

### 📝 Documentation

Workflows that generate, update, or maintain documentation automatically.

*No workflows yet. Be the first to contribute!*

### 🛡️ Security

Workflows focused on security analysis, vulnerability detection, or compliance.

*No workflows yet. Be the first to contribute!*

### 🧪 Testing

Workflows that enhance testing processes, generate test cases, or analyze test results.

*No workflows yet. Be the first to contribute!*

### 🚀 Deployment & Release

Workflows that handle deployment, release management, or publishing tasks.

*No workflows yet. Be the first to contribute!*

### 🎯 Specialized Use Cases

Unique or domain-specific workflows that showcase creative uses of Gemini CLI.

*No workflows yet. Be the first to contribute!*

## Featured Workflows

*Coming soon!* This section will highlight particularly innovative or popular community workflows.

---

*Want to see your workflow featured here? Check out our [submission guidelines](./README.md#share-your-workflow)!*
