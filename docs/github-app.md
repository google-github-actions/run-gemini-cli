# Authenticating with a GitHub App

This guide details the authentication methods for the Gemini CLI on GitHub, ensuring it has the necessary permissions to interact with the GitHub API on your behalf.

You can authenticate using one of two methods:
*   **GitHub App (Recommended):** Provides the most secure and flexible approach by creating a dedicated app with specific permissions.
*   **Default `GITHUB_TOKEN`:** A simpler method suitable for basic use cases, using the token automatically generated for each workflow run.
  
- [Authenticating with a GitHub App](#authenticating-with-a-github-app)
  - [Using a GitHub App (Recommended)](#using-a-github-app-recommended)
    - [Step 1: Create a New GitHub App](#step-1-create-a-new-github-app)
    - [Step 2: Generate a Private Key and Get the App ID](#step-2-generate-a-private-key-and-get-the-app-id)
    - [Step 3: Install the App in Your Repository](#step-3-install-the-app-in-your-repository)
    - [Step 4: Configure Repository Variables and Secrets](#step-4-configure-repository-variables-and-secrets)
  - [Using the Default `GITHUB_TOKEN`](#using-the-default-github_token)
  - [Workflow Configuration Examples](#workflow-configuration-examples)

## Using a GitHub App (Recommended)

For optimal security and control, we strongly recommend creating a custom GitHub App. This method allows you to grant the action fine-grained permissions, limiting its access to only what is necessary.

### Step 1: Create a New GitHub App

1.  Navigate to **GitHub Settings** > **[Developer settings](https://github.com/settings/developers)** > **[GitHub Apps](https://github.com/settings/apps)** and click **New GitHub App**.
2.  **Complete the app registration:**
    *   **GitHub App name:** Give your app a unique and descriptive name (e.g., `MyOrg-Gemini-Assistant`).
    *   **Homepage URL:** Enter your organization's website or the URL of the repository where you'll use the action.
3.  **Disable Webhooks:** Uncheck the **Active** checkbox under the "Webhooks" section. This action does not require webhook notifications.
4.  **Set Repository Permissions:** Under the "Repository permissions" section, grant the following permissions required for the example workflows:
    *   **Contents:** `Read & write`
    *   **Issues:** `Read & write`
    *   **Pull requests:** `Read & write`
    > **Note:** Always adhere to the principle of least privilege. If your custom workflows require fewer permissions, adjust these settings accordingly.
5.  Click **Create GitHub App**.

### Step 2: Generate a Private Key and Get the App ID

1.  After your app is created, you will be returned to its settings page. Click **Generate a private key**.
2.  Save the downloaded `.pem` file securely. This file is your app's private key and is highly sensitive.
3.  Make a note of the **App ID** listed at the top of the settings page.

### Step 3: Install the App in Your Repository

1.  From your app's settings page, select **Install App** from the left sidebar.
2.  Choose the organization or account where you want to install the app.
3.  Select **Only select repositories** and choose the repository (or repositories) where you intend to use the action.
4.  Click **Install**.

### Step 4: Configure Repository Variables and Secrets

1.  Navigate to your repository's **Settings** > **Secrets and variables** > **Actions**.
2.  Select the **Variables** tab and click **New repository variable**.
    *   **Name:** `APP_ID`
    *   **Value:** Enter the App ID you noted earlier.
3.  Select the **Secrets** tab and click **New repository secret**.
    *   **Name:** `APP_PRIVATE_KEY`
    *   **Secret:** Paste the entire contents of the `.pem` file you downloaded.


## Using the Default `GITHUB_TOKEN`

For simpler scenarios, the action can authenticate using the default `GITHUB_TOKEN` that GitHub automatically creates for each workflow run.

If the `APP_ID` and `APP_PRIVATE_KEY` secrets are not configured in your repository, the action will automatically fall back to this method.

**Limitations:**

*   **Limited Permissions:** The `GITHUB_TOKEN` has a restricted set of permissions. You may need to grant additional permissions directly within your workflow file to enable specific functionalities, such as:

```
permissions:                                                                                 
    contents: read                                                                             
    issues: write                                                                              
    pull-requests: write
```

*   **Job-Scoped:** The token's access is limited to the repository where the workflow is running and expires when the job is complete.


## Workflow Configuration Examples

For complete, working examples of how to configure authentication, please refer to the workflows in the [`/examples`](../examples) directory.

These examples demonstrate how to set up conditional authentication that works with both a GitHub App and the default `GITHUB_TOKEN`.
