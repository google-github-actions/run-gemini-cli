# Gemini CLI Workflows

This directory contains a collection of example workflows that demonstrate how to use the [Google Gemini CLI GitHub Action](https://github.com/google-github-actions/run-gemini-cli). These workflows are designed to be reusable and customizable for your own projects.

- [Gemini CLI Workflows](#gemini-cli-workflows)
  - [Available Workflows](#available-workflows)
  - [Setup](#setup)
  - [Customizing Workflows](#customizing-workflows)
  - [Awesome Workflows](#awesome-workflows)
    - [Share Your Workflow](#share-your-workflow)

## Available Workflows

*   **[Gemini Dispatch](./gemini-dispatch)**: A central dispatcher that routes requests to the appropriate workflow based on the triggering event and the command provided in the comment.
*   **[Issue Triage](./issue-triage)**: Automatically triage GitHub issues using Gemini. This workflow can be configured to run on a schedule or be triggered by issue events.
*   **[Pull Request Review](./pr-review)**: Automatically review pull requests using Gemini. This workflow can be triggered by pull request events and provides a comprehensive review of the changes.
*   **[Gemini CLI Assistant](./gemini-assistant)**: A general-purpose, conversational AI assistant that can be invoked within pull requests and issues to perform a wide range of tasks.

## Setup

For detailed setup instructions, including prerequisites and authentication, please refer to the main [Authentication documentation](../../docs/authentication.md).

To use a workflow, you can utilize either of the following steps:
- Run the `/setup-github` command in Gemini CLI on your terminal to set up workflows for your repository.
- Copy the workflow files into your repository's `.github/workflows` directory.

## Customizing Workflows

Gemini CLI workflows are highly configurable. You can adjust their behavior by editing the corresponding `.yml` files in your repository.

For detailed configuration options, including Gemini CLI settings, timeouts, and permissions, see our [Configuration Guide](./CONFIGURATION.md).

## Awesome Workflows

Discover awesome workflows created by the community! These are publicly available workflows that showcase creative and powerful uses of the Gemini CLI GitHub Action.

👉 **[View all Awesome Workflows](./AWESOME.md)**

### Share Your Workflow

Have you created an awesome workflow using Gemini CLI? We'd love to feature it in our [Awesome Workflows](./AWESOME.md) page! 

**Submission Process:**
1. **Ensure your workflow is public** and well-documented
2. **Fork this repository** and create a new branch
3. **Add your workflow** to the appropriate category section in [AWESOME.md](./AWESOME.md) using the [workflow template](./AWESOME.md#workflow-template)
   - If none of the existing categories fit your workflow, feel free to propose a new category
4. **Open a pull request** with your addition
5. **Include a brief summary** in your PR description of what your workflow does and why it's awesome

**What makes a workflow "awesome"?**
- Solves a real problem or provides significant value
- Is well-documented with clear setup instructions
- Follows best practices for security and performance
- Has been tested and is actively maintained
- Includes example configurations or use cases

**Note:** This process is specifically for sharing community workflows. We also recommend reading our [CONTRIBUTING.md](../../CONTRIBUTING.md) file for general contribution guidelines and best practices that apply to all pull requests.

**Workflow Template:**

When adding your workflow to [AWESOME.md](./AWESOME.md), use this format:

```markdown
#### <Workflow Name>

**Repository:** [<owner>/<repo>](https://github.com/<owner>/<repo>)  

Brief description of what the workflow does and its key features.

**Key Features:**
- Feature 1
- Feature 2
- Feature 3

**Setup Requirements:**
- Requirement 1
- Requirement 2 (if any)

**Example Use Cases:**
- Use case 1
- Use case 2

**Workflow File:** [View on GitHub](https://github.com/<owner>/<repo>/blob/main/.github/workflows/<workflow-name>.yml)
```

Browse our [Awesome Workflows](./AWESOME.md) page to see what the community has created!
