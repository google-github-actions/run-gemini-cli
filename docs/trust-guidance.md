# Gemini-CLI Specific GitHub Actions (GHA) Trust Guidance

This guide outlines essential security configurations and best practices for integrating the Gemini CLI with your GitHub Actions (GHA) workflows. Version `0.39.1` introduces security controls for Gemini CLI in headless mode. When running Gemini CLI in CI, like GitHub Actions, you must determine if your CI workflow operates on trusted or untrusted data. If your workflow operates exclusively on trusted data, e.g., code or prompts from repo owners, you can safely set `GEMINI_TRUST_WORKSPACE=true`. If your workflow operates on untrusted data, follow the guidance below, and set the environment variable after hardening your workflow.

**1\. Determine if your workflow processes untrusted data**

The required security configuration for your workflow depends on the origin of the data it processes:

| Data Trust Level                                                                      | Required Configuration & Action                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Fully Trusted Data** e.g. any inputs from high-trust collaborators.                 | Set `GEMINI_TRUST_WORKSPACE=true` in your workflow.                                         |
| **Untrusted Data** e.g. GitHub issues or pull requests submitted by non-collaborators | Follow the guidelines below to harden your workflow, and then set the environment variable. |

**2\. Permissions and Principle of Least Privilege**

Follow these principles to protect your repository, especially when dealing with untrusted input:

- **Exercise Least Privilege:** Explicitly exercise the principle of least privilege. Grant only the minimum privileges necessary for the workflow to complete its task.
- **GitHub Token Permissions:** Set a **minimal set of GH token permissions** for your GitHub token (e.g., `issues: read`). Be aware that even token permissions that may be considered "downscoped" can still pose a security risk (e.g. `actions: write`). See GitHub’s [Modifying Github Tokens for Least Privilege](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token#modifying-the-permissions-for-the-github_token)
- **Limit credential permissions** as much as possible to limit the risk if they are stolen. (See GitHub’s [Limiting credential permissions](https://docs.github.com/en/actions/concepts/security/secrets#limiting-credential-permissions))
- **Workflow Triggering:** Prefer workflows where the **PR review is kicked off intentionally by a maintainer** (manually triggered workflows) and not on forks, to avoid automatically processing untrusted content.

See [Best Practices](./best-practices.md) and GitHub’s [GHA Best Practices for Security](https://docs.github.com/en/actions/reference/security/secure-use)

**3\. Tool and Command Allow Listing**

If you are processing **untrusted data**, you must strictly limit which tools the Gemini CLI is allowed to execute.

- **Prefer a minimal set of tools** such as `list_directory`, `read_file`, and `grep_search`.
- **Allowlist commands only if necessary** and take caution allowing commands with dangerous functionality.

To ensure your workflows utilize the most current security controls and native tools, please see our [example workflows](../examples/workflows/).
