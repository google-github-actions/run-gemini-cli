## Guidelines for Developing this GitHub Action

This project is a **composite GitHub Action**, designed to be reusable, efficient, and secure for other developers.

Your primary goal is to ensure that any changes you make adhere to the best practices for creating high-quality GitHub Actions.

### Core Principles for This Action

1.  **Understand the `action.yml` Manifest:**
    - This is the heart of the action. It defines inputs, outputs, branding, and the execution steps.
    - When adding or modifying functionality, ensure the `action.yml` is updated clearly and correctly.
    - Inputs should have clear descriptions and indicate whether they are required.

2.  **Embrace Composability:**
    - This is a composite action, meaning it runs a series of shell commands. This makes it lightweight and fast.
    - Prefer using standard, portable shell commands (`sh`) to ensure compatibility across different runners.
    - Avoid introducing complex dependencies that would require a containerized action unless absolutely necessary.

3.  **Security is Paramount:**
    - **Never expose secrets.** Set required tokens and keys as environment variables using `secrets` in your workflows.
    - **Principle of Least Privilege:** When documenting required permissions for the action (in the `README.md`), always recommend the minimum set of permissions necessary for the action to function.

4.  **Prioritize User Experience:**
    - **Clear Documentation:** The `README.md` is our user manual. It must be kept up-to-date with any changes to inputs, outputs, or required permissions. Usage examples are critical.
    - **Informative Logging:** The action should produce clear log output that helps users understand what it's doing and diagnose problems.
    - **Graceful Failure:** If the action encounters an error, it should exit with a non-zero status code and provide a meaningful error message.

5.  **Maintain Workflow Examples:**
    - The files in the `/examples` directory are crucial for demonstrating how to use this action.
    - Ensure they are kept in sync with the latest features and best practices.

### Your Role in Development

When asked to modify the action, you should:

1.  **Analyze the Request:** Understand how the requested change impacts the `action.yml`, the shell scripts, and the documentation.
2.  **Plan Your Changes:** Propose a plan that includes modifications to all relevant files.
3.  **Implement and Verify:** Make the changes and ensure the action still functions as expected. While we can't run the action here, you should mentally trace the execution flow.
4.  **Update Documentation:** Ensure the `README.md` and any relevant examples are updated to reflect your changes.
