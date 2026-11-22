# Quick Start Guide

Get Gemini CLI running in your GitHub repository in under 10 minutes.

## Prerequisites

- A GitHub repository you control
- One of: Gemini API key, Google Cloud project, or GitHub App

## Option 1: Gemini API Key (Fastest - 5 minutes)

**Step 1: Get a free API key**
1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

**Step 2: Add to GitHub**
1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GEMINI_API_KEY`
4. Paste your API key
5. Save

**Step 3: Create a workflow file**
Create `.github/workflows/gemini-basic.yml`:

```yaml
name: Gemini Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/run-gemini-cli@v0
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          prompt: "Review this pull request for code quality and potential issues."
```

**Done!** Open a PR to test it.

---

## Option 2: Automated Setup in CLI

```bash
# Install Gemini CLI locally
gemini

# In the CLI terminal, run:
/setup-github

# Follow prompts to configure GitHub workflows
```

---

## Option 3: Google Cloud / Vertex AI (Most Secure)

Run the setup script:

```bash
./scripts/setup_workload_identity.sh \
  --repo "owner/your-repo" \
  --project "your-gcp-project"
```

The script handles all configuration automatically.

---

## Next Steps

### Trigger Gemini in Comments

Once workflows are set up, mention Gemini in issues or PRs:

```
@gemini-cli explain this function

@gemini-cli /review check for security issues

@gemini-cli suggest improvements
```

### Customize Your Workflow

Edit the workflow file to change:

- **Prompt**: What task Gemini should perform
- **Triggers**: When it runs (PR opened, schedule, etc.)
- **Permissions**: What access level it needs

### Explore Pre-Built Workflows

Check [examples/workflows](../examples/workflows/README.md) for:
- PR review automation
- Issue triage automation
- Scheduled code analysis
- General-purpose assistant

---

## Troubleshooting

**API Key not working?**
- Verify it's added to repository secrets (not variables)
- Check it's named exactly `GEMINI_API_KEY`
- Test the key in Google AI Studio

**Workflow doesn't run?**
- Check repository has `.github/workflows/` directory
- Verify the workflow syntax is valid (lint it in VS Code)
- Check Actions tab for error messages

**Need help?**
- See detailed docs in [docs/](../docs/) folder
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) for development info
- Open an issue on GitHub

---

## What's Next?

- Customize prompts for your team's needs
- Set up multiple workflows for different tasks
- Create a [GEMINI.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/configuration.md#context-files-hierarchical-instructional-context) with project guidelines
- Explore [extensions](../docs/extensions.md) for custom capabilities
