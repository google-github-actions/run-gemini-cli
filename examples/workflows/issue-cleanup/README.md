# Issue Cleanup Workflow

This document describes a workflow to batch-process and clean up older open issues using Gemini CLI.

## Overview

The Issue Cleanup workflow is designed to automate the triage of stale issues by using the Gemini CLI to:

1. **Check for Staleness and Vagueness**: Identifies issues with insufficient information. If a request for more information has gone unanswered for over a week, it closes the issue. If it's a new vague issue, it asks the reporter for specific details.
2. **Check Code Validity**: Determines if an issue is still relevant against the current codebase. If the issue has already been resolved implicitly, it will close the issue with an explanation.
3. **Find Duplicates**: Checks if the issue has a more recent duplicate. If a duplicate exists, it closes the issue and links to the duplicate.
4. **Summarize for Triage**: If an issue is still valid and unique, it provides a summary comment based on customizable instructions (e.g., categorizing it as `Maintainer-only` or `Help-wanted`). If no custom instructions are provided, it falls back to a standard triage summary (identifying the core problem, impact, and next steps).

## Usage

This example is tailored to process issues in your repository matching specific labels (`area/core`, `area/extensions`, `area/site`, `area/non-interactive`), selecting the 10 issues with the oldest last update time.

To adapt this to your own repository:

1. Copy `gemini-issue-cleanup.yml` to your repository's `.github/workflows/` directory.
2. Update the search string in the `Find old issues for cleanup` step in `gemini-issue-cleanup.yml` to match your repository's labels.
3. Copy `gemini-issue-cleanup.toml` to your `.github/commands/` directory.
