# Contributing to run-gemini-cli

First off, thank you for considering contributing to the run-gemini-cli!

- [Contributing to run-gemini-cli](#contributing-to-run-gemini-cli)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
  - [Development Setup](#development-setup)
  - [Contribution Workflow](#contribution-workflow)
  - [Development Guidelines](#development-guidelines)
    - [Code Standards](#code-standards)
      - [Security](#security)
      - [Code Quality](#code-quality)
      - [Action Standards](#action-standards)
  - [Testing](#testing)
  - [Documentation](#documentation)
    - [Updating Action Inputs and Outputs](#updating-action-inputs-and-outputs)
  - [PR Review Process](#pr-review-process)
  - [Community \& Communication](#community--communication)

## Overview

This project is a composite GitHub Action that integrates Gemini AI into GitHub workflows. We welcome contributions including bug fixes, feature enhancements, documentation improvements, and new workflow examples.

## Prerequisites

Before contributing, ensure you have:

- Git installed on your local machine
- Node.js and npm installed (for documentation generation)

## Development Setup

1. **Fork and Clone the Repository**
   - Fork the repository on GitHub by clicking the "Fork" button
   - Clone your forked repository to your local machine:
     ```sh
     git clone https://github.com/YOUR_USERNAME/run-gemini-cli.git
     cd run-gemini-cli
     ```

2. **Set Upstream Remote**
   - Add the original repository as the `upstream` remote:
     ```sh
     git remote add upstream https://github.com/google-github-actions/run-gemini-cli.git
     ```

3. **Install Dependencies**
   - Install the required Node.js dependencies:
     ```sh
     npm install
     ```

## Contribution Workflow

1. **Create a Branch**
    - Create a new branch for your changes. Use a descriptive name:
      ```sh
      git checkout -b feature/your-descriptive-branch-name
      ```

2. **Make Your Changes**
    - Implement your changes following the [development guidelines](#development-guidelines)
    - If you modify `action.yml` inputs or outputs, update the documentation:
      ```sh
      npm run docs
      ```
    - If you update workflow files in `/.gemini/workflows/`, run `./scripts/generate-examples.sh` to auto-generate the examples.

3. **Commit Your Changes**
    - Commit with a descriptive message following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
    
    **Example of a detailed commit message:**
    ```sh
    git commit -m "feat: add custom timeout support for workflow execution

    Users reported workflow failures in large repositories where Gemini CLI
    operations exceed the default GitHub Actions timeout limit. This causes
    incomplete analysis and frustrating failures for complex codebases.

    Add configurable timeout support to prevent workflow timeouts:
    - Enable users to set custom timeout values based on repository size
    - Provide graceful handling when operations approach time limits  
    - Include clear error messages when timeouts occur
    - Document timeout configuration for different use cases
    
    This resolves timeout issues for enterprise users with large repositories
    and improves the overall reliability of the action.
    
    Closes #123"
    ```

4. **Keep Your Fork Synced**
    - Sync your `main` branch with the `upstream` repository:
      ```sh
      git checkout main
      git pull upstream main
      ```

5. **Rebase Your Branch**
    - Rebase your feature branch on top of the latest `main`:
      ```sh
      git checkout feature/your-descriptive-branch-name
      git rebase main
      ```

6. **Push Your Changes**
    - Push your changes to your forked repository:
      ```sh
      git push --force-with-lease origin feature/your-descriptive-branch-name
      ```

7. **Create a Pull Request**
    - Go to your forked repository on GitHub and create a pull request

## Development Guidelines

When contributing to this composite GitHub Action:

### Code Standards

Follow these principles when contributing to this composite GitHub Action:

#### Security
- **Principle of least privilege**: Request only necessary permissions
- **Validate inputs**: Sanitize user inputs to prevent security issues
- **Secure defaults**: Choose the most secure configuration options

#### Code Quality
- **Clear naming**: Use descriptive variable and function names
- **Error handling**: Provide meaningful error messages with context
- **Shell best practices**: Write portable, robust shell scripts
- **Documentation**: Keep code and documentation synchronized

#### Action Standards
- **YAML consistency**: Use consistent formatting and structure
- **Input/output documentation**: Clearly describe all parameters
- **Version management**: Pin dependencies to specific versions

## Testing

Before submitting your PR:

-  **Validate action.yml**: Ensure the manifest is valid YAML
-  **Test workflows**: Verify example workflows work as expected
-  **Check documentation**: Ensure all examples and references are accurate
-  **Lint shell scripts**: Use tools like `shellcheck` for script validation

## Documentation

When making changes:

- Update `README.md` if you modify inputs, outputs, or usage
- Update workflow examples in `/workflows` directory
- Add or update relevant documentation in `/docs`
- Ensure all links and references are working
- **Important**: If you modify `action.yml` inputs or outputs, run `npm run docs` to automatically update the documentation in `README.md`

### Updating Action Inputs and Outputs

The inputs and outputs documentation in `README.md` is automatically generated from `action.yml`. After modifying `action.yml`:

1. Run the documentation update script:
   ```sh
   npm run docs
   ```

2. This will update the `<!-- BEGIN_AUTOGEN_INPUTS -->` and `<!-- BEGIN_AUTOGEN_OUTPUTS -->` sections in `README.md`

3. Commit both `action.yml` and the updated `README.md` together

## PR Review Process

Once you submit a pull request, a member of the team will review your changes. We may ask for changes or clarification on your implementation. Once your pull request is approved, it will be merged into the `main` branch.

## Community & Communication

If you have any questions or need help with your contribution, you can reach out to us on [GitHub Discussions](https://github.com/google-github-actions/run-gemini-cli/discussions).
