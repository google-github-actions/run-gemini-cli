# Best Practices

This guide provides best practices for using the Gemini CLI GitHub Action, with a focus on repository security and operational excellence.

- [Best Practices](#best-practices)
  - [Repository Security](#repository-security)
    - [Branch and Tag Protection](#branch-and-tag-protection)
    - [Restrict PR Approvers](#restrict-pr-approvers)
  - [Workflow Configuration](#workflow-configuration)
    - [Use Workload Identity Federation](#use-workload-identity-federation)
    - [Use Secrets for Sensitive Data](#use-secrets-for-sensitive-data)
    - [Pin Action Versions](#pin-action-versions)
  - [Creating Custom Workflows](#creating-custom-workflows)
  - [Monitoring and Auditing](#monitoring-and-auditing)

## Repository Security

A secure repository is the foundation for any reliable and safe automation. We strongly recommend implementing the following security measures.

### Branch and Tag Protection

Protecting your branches and tags is critical to preventing unauthorized changes. You can use [repository rulesets] to configure protection for your branches and tags.

We recommend the following at a minimum for your `main` branch:

*   **Require a pull request before merging**
*   **Require a minimum number of approvals**
*   **Dismiss stale approvals**
*   **Require status checks to pass before merging**

For more information, see the GitHub documentation on [managing branch protections].

### Restrict PR Approvers

To prevent fraudulent or accidental approvals, you can restrict who can approve pull requests.

*   **CODEOWNERS**: Use a [`CODEOWNERS` file] to define individuals or teams that are responsible for code in your repository.
*   **Code review limits**: [Limit code review approvals] to specific users or teams.

## Workflow Configuration

### Use Workload Identity Federation

For the most secure authentication to Google Cloud, we recommend using [Workload Identity Federation]. This keyless authentication method eliminates the need to manage long-lived service account keys.

For detailed instructions on how to set up Workload Identity Federation, please refer to our [**Authentication documentation**](./authentication.md).

### Use Secrets for Sensitive Data

Never hardcode secrets (e.g., API keys, tokens) in your workflows. Use [GitHub Secrets] to store sensitive information.

### Pin Action Versions

To ensure the stability and security of your workflows, pin the Gemini CLI action to a specific version.

```yaml
uses: google-github-actions/run-gemini-cli@v0
```

## Creating Custom Workflows

When creating your own workflows, we recommend starting with the [examples provided in this repository](../examples/workflows/). These examples demonstrate how to use the `run-gemini-cli` action for various use cases, such as pull request reviews, issue triage, and more.

Ensure the new workflows you create follow the principle of least privilege. Only grant the permissions necessary to perform the required tasks.

## Monitoring and Auditing

To gain deeper insights into the performance and behavior of Gemini CLI, you can enable OpenTelemetry to send traces, metrics, and logs to your Google Cloud project. This is highly recommended for production environments to monitor for unexpected behavior and performance issues.

For detailed instructions on how to set up and configure observability, please refer to our [**Observability documentation**](./observability.md).

[repository rulesets]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
[managing branch protections]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
[`codeowners` file]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
[limit code review approvals]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-pull-request-reviews-in-your-repository#enabling-code-review-limits
[github secrets]: https://docs.github.com/en/actions/security-guides/encrypted-secrets
[Workload Identity Federation]: https://cloud.google.com/iam/docs/workload-identity-federation
