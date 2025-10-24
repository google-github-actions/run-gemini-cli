# Authentication

This guide covers the different ways to authenticate the Gemini CLI action in your GitHub Actions workflows.

- [Authentication](#authentication)
  - [Google Authentication](#google-authentication)
    - [Choosing a Google Authentication Method](#choosing-a-google-authentication-method)
    - [Method 1: Authenticating with a Gemini API Key](#method-1-authenticating-with-a-gemini-api-key)
      - [Prerequisites](#prerequisites)
      - [Setup](#setup)
      - [Example](#example)
    - [Method 2: Authenticating with Google Cloud](#method-2-authenticating-with-google-cloud)
      - [Setup Script](#setup-script)
      - [Connecting to Vertex AI](#connecting-to-vertex-ai)
      - [Connecting to Gemini Code Assist](#connecting-to-gemini-code-assist)
  - [GitHub Authentication](#github-authentication)
    - [Method 1: Using the Default `GITHUB_TOKEN`](#method-1-using-the-default-github_token)
    - [Method 2: Using a GitHub App (Recommended)](#method-2-using-a-github-app-recommended)
      - [Step 1: Create a New GitHub App](#step-1-create-a-new-github-app)
      - [Step 2: Generate a Private Key and Get the App ID](#step-2-generate-a-private-key-and-get-the-app-id)
      - [Step 3: Install the App in Your Repository](#step-3-install-the-app-in-your-repository)
      - [Step 4: Configure Repository Variables and Secrets](#step-4-configure-repository-variables-and-secrets)
  - [Additional Resources](#additional-resources)

## Google Authentication

### Choosing a Google Authentication Method

The Gemini CLI Action requires authentication. Choose the one that best fits your use case.

| Method                           | Use Case                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| **Gemini API Key**               | The simplest method. Ideal for projects that do not require Google Cloud integration. |
| **Workload Identity Federation** | The most secure method for authenticating to Google Cloud services.                   |

### Method 1: Authenticating with a Gemini API Key

This is the simplest method and is suitable for projects that do not require Google Cloud integration.

#### Prerequisites

- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

#### Setup

1.  **Create an API Key**: Go to Google AI Studio and create a new API key.
2.  **Add to GitHub Secrets**: In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add a new repository secret with the name `GEMINI_API_KEY` and paste your key as the value.

#### Example

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    prompt: |-
      Explain this code
    gemini_api_key: '${{ secrets.GEMINI_API_KEY }}'
```

### Method 2: Authenticating with a Vertex AI API Key

This method is used for quick setup using Vertex AI through Google Cloud Console

#### Prerequisites

- A Vertex AI API key from Google Cloud Console

#### Setup

1.  **Create an API Key**: Obtain your Google Cloud [API key](https://cloud.google.com/vertex-ai/generative-ai/docs/start/api-keys?usertype=newuser)
2.  **Add to GitHub Secrets**: In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add a new repository secret with the name `GOOGLE_API_KEY` and paste your key as the value and create new variable with the name `GOOGLE_GENAI_USE_VERTEXAI` and set value as `true`.

#### Example

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    prompt: |-
      Explain this code
    google_api_key: '${{ secrets.GOOGLE_API_KEY }}'
```

### Method 3: Authenticating with Google Cloud

**[Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)** is Google Cloud's preferred, keyless authentication method for GitHub Actions. It provides:

- **Enhanced security**: No long-lived credentials or keys to manage.
- **Simplified setup**: A single script configures the necessary resources.
- **Built-in observability**: Automatic permissions for logging, monitoring, and tracing.

The process uses GitHub's OIDC tokens to directly and securely access Google Cloud resources.

```
GitHub Actions → OIDC Token → Workload Identity Pool → Direct GCP Resource Access
```

#### Setup Script

The `setup_workload_identity.sh` script automates the entire setup process for both Vertex AI and Gemini Code Assist.

**Prerequisites**

Required Tools:

- A Google Cloud Project with billing enabled.
- The [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`).
- Optional: The GitHub CLI [gh](https://docs.github.com/en/github-cli/github-cli/quickstart)

Your user account needs these permissions in the target GCP project to run the script:

- `resourcemanager.projects.setIamPolicy`
- `iam.workloadIdentityPools.create`
- `iam.workloadIdentityPools.update`
- `serviceusage.services.enable`

**Quick Start**

Basic setup for your repository:

```shell
./scripts/setup_workload_identity.sh --repo "[OWNER]/[REPO]" --project "[GOOGLE_CLOUD_PROJECT]"
```

**Required Parameters:**
- `OWNER/REPO`: Your GitHub repository in the format `owner/repo`. Here, `OWNER` means your GitHub organization (for organization-owned repos) or username (for user-owned repos).
- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID.

For example:

```shell
./scripts/setup_workload_identity.sh --repo "my-github-org/my-github-repo" --project "my-gcp-project"
```

**Usage**

Command Line Options:

| Option                             | Description                                    | Required | Example                       |
| ---------------------------------- | ---------------------------------------------- | -------- | ----------------------------- |
| `--repo OWNER/REPO`                | GitHub repository                              | Yes      | `--repo google/my-repo`       |
| `--project GOOGLE_CLOUD_PROJECT`   | Google Cloud project ID                        | Yes      | `--project my-gcp-project`    |
| `--location GOOGLE_CLOUD_LOCATION` | GCP project location (defaults to `global`)    | No       | `--location us-east1`         |
| `--pool-name NAME`                 | Custom pool name (default: auto-generated)     | No       | `--pool-name my-pool`         |
| `--provider-name NAME`             | Custom provider name (default: auto-generated) | No       | `--provider-name my-provider` |
| `--help`                           | Show help message                              | No       |                               |

**What the Script Does**

1.  **Creates Workload Identity Pool**: A shared resource (auto-generated unique name based on repository).
2.  **Creates Workload Identity Provider**: Unique per repository, linked to the pool (auto-generated unique name based on repository).
3.  **Creates Service Account**: For authentication with required permissions.
4.  **Grants Permissions**: Assigns IAM roles for observability and AI services.
5.  **Outputs Configuration**: Prints the GitHub Actions variables needed for your workflow.

**Automatic Permissions**

The script automatically grants these essential IAM roles:

- **`roles/logging.logWriter`**: To write logs to Cloud Logging.
- **`roles/monitoring.editor`**: To write metrics to Cloud Monitoring.
- **`roles/cloudtrace.agent`**: To send traces to Cloud Trace.
- **`roles/aiplatform.user`**: To make inference calls to Vertex AI.
- **`roles/cloudaicompanion.user`**: To make inference calls using Gemini Code Assist.
- **`roles/iam.serviceAccountTokenCreator`**: To generate access tokens.

#### Connecting to Vertex AI

This is the standard method for authenticating directly with the Vertex AI API using your GCP project's identity.

**Prerequisites**

- A Google Cloud project with the **Vertex AI API** enabled.

**GitHub Configuration**

After running the `setup_workload_identity.sh` script, add the following variables to your repository's **Settings > Secrets and variables > Actions**:

| Variable Name               | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `GCP_WIF_PROVIDER`          | The resource name of the Workload Identity Provider. |
| `SERVICE_ACCOUNT_EMAIL`     | The service account with the required permissions.   |
| `GOOGLE_CLOUD_PROJECT`      | Your Google Cloud project ID.                        |
| `GOOGLE_CLOUD_LOCATION`     | Your Google Cloud project Location.                  |
| `GOOGLE_GENAI_USE_VERTEXAI` | Set to `true` to use Vertex AI.                      |

**Example**

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    gcp_workload_identity_provider: '${{ vars.GCP_WIF_PROVIDER }}'
    gcp_service_account: '${{ vars.SERVICE_ACCOUNT_EMAIL }}'
    gcp_project_id: '${{ vars.GOOGLE_CLOUD_PROJECT }}'
    gcp_location: '${{ vars.GOOGLE_CLOUD_LOCATION }}'
    use_vertex_ai: '${{ vars.GOOGLE_GENAI_USE_VERTEXAI }}'
    prompt: |-
      Explain this code
```

> [!NOTE]
> You can use direct Workload Identity Federation without a service account by setting `gcp_token_format: ''` and omitting `gcp_service_account`.

#### Connecting to Gemini Code Assist

If you have a **Gemini Code Assist** subscription, you can configure the action to use it for authentication.

**Prerequisites**

- A Google Cloud project with an active Gemini Code Assist subscription.

**GitHub Configuration**

After running the `setup_workload_identity.sh` script, add the following variables to your repository's **Settings > Secrets and variables > Actions**:

| Variable Name           | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `GCP_WIF_PROVIDER`      | The resource name of the Workload Identity Provider.    |
| `GOOGLE_CLOUD_PROJECT`  | Your Google Cloud project ID.                           |
| `GOOGLE_CLOUD_LOCATION` | Your Google Cloud project Location.                     |
| `SERVICE_ACCOUNT_EMAIL` | The email of the service account for Code Assist.       |
| `GOOGLE_GENAI_USE_GCA`  | Set to `true` to authenticate using Gemini Code Assist. |

**Example**

```yaml
- uses: 'google-github-actions/run-gemini-cli@v0'
  with:
    gcp_workload_identity_provider: '${{ vars.GCP_WIF_PROVIDER }}'
    gcp_service_account: '${{ vars.SERVICE_ACCOUNT_EMAIL }}'
    gcp_project_id: '${{ vars.GOOGLE_CLOUD_PROJECT }}'
    gcp_location: '${{ vars.GOOGLE_CLOUD_LOCATION }}'
    use_gemini_code_assist: '${{ vars.GOOGLE_GENAI_USE_GCA }}'
    prompt: |-
      Explain this code
```

> [!NOTE]
> You can use direct Workload Identity Federation without a service account by setting `gcp_token_format: ''` and omitting `gcp_service_account`.

## GitHub Authentication

This action requires a GitHub token to interact with the GitHub API. You can authenticate in two ways:

### Method 1: Using the Default `GITHUB_TOKEN`

For simpler scenarios, the action can authenticate using the default `GITHUB_TOKEN` that GitHub automatically creates for each workflow run.

If the `APP_ID` and `APP_PRIVATE_KEY` secrets are not configured in your repository, the action will automatically fall back to this method.

**Limitations:**

*   **Limited Permissions:** The `GITHUB_TOKEN` has a restricted set of permissions. You may need to grant additional permissions directly within your workflow file to enable specific functionalities, such as:

```yaml
permissions:
  contents: 'read'
  issues: 'write'
  pull-requests: 'write'
```

*   **Job-Scoped:** The token's access is limited to the repository where the workflow is running and expires when the job is complete.

### Method 2: Using a GitHub App (Recommended)

For optimal security and control, we strongly recommend creating a custom GitHub App. This method allows you to grant the action fine-grained permissions, limiting its access to only what is necessary.

#### Step 1: Create a New GitHub App

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

An example manifest is also available at [`examples/github-app/custom_app_manifest.yml`](../examples/github-app/custom_app_manifest.yml). For details on registering a GitHub App from a manifest, see the [GitHub documentation](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest).

#### Step 2: Generate a Private Key and Get the App ID

1.  After your app is created, you will be returned to its settings page. Click **Generate a private key**.
2.  Save the downloaded `.pem` file securely. This file is your app's private key and is highly sensitive.
3.  Make a note of the **App ID** listed at the top of the settings page.

#### Step 3: Install the App in Your Repository

1.  From your app's settings page, select **Install App** from the left sidebar.
2.  Choose the organization or account where you want to install the app.
3.  Select **Only select repositories** and choose the repository (or repositories) where you intend to use the action.
4.  Click **Install**.

#### Step 4: Configure Repository Variables and Secrets

1.  Navigate to your repository's **Settings** > **Secrets and variables** > **Actions**.
2.  Select the **Variables** tab and click **New repository variable**.
    *   **Name:** `APP_ID`
    *   **Value:** Enter the App ID you noted earlier.
3.  Select the **Secrets** tab and click **New repository secret**.
    *   **Name:** `APP_PRIVATE_KEY`
    *   **Secret:** Paste the entire contents of the `.pem` file you downloaded.

## Additional Resources

- [Google Cloud Direct Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [google-github-actions/auth Documentation](https://github.com/google-github-actions/auth)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
