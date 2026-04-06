# Issue Cleanup Workflow

This document describes a workflow to batch-process and clean up older open issues using Gemini CLI.

## Overview

The Issue Cleanup workflow is designed to automate the triage of stale issues by using the Gemini CLI to:

1. **Check for Staleness (Native)**: Identifies if an issue has been waiting for reporter feedback for over 7 days. If so, it closes the issue directly via a GitHub Action script to save AI resources.
2. **Check for Age and Vagueness (AI)**: If an issue is not stale but hasn't been updated in over a month, it asks the reporter to reproduce the issue with the latest build. If the issue lacks sufficient information (e.g., reproduction steps), it asks the reporter for specific details and stops.
3. **Check Code Validity (AI)**: Determines if an issue is still relevant against the current codebase. The agent may attempt to write and execute a minimal reproduction script to verify if a bug has been resolved, or manually inspect the code. If verified as fixed, it will close the issue with an explanation.
4. **Find Duplicates (AI)**: Checks if the issue has a more recent duplicate. If a duplicate exists, it closes the issue and links to the duplicate.
5. **Summarize for Triage (AI)**: If an issue is still valid and unique, it provides a summary comment based on customizable instructions (e.g., categorizing it as `Maintainer-only` or `Help-wanted`). If no custom instructions are provided, it falls back to a standard triage summary.

## Usage

This example is tailored to process issues in your repository matching specific labels (`area/core`, `area/extensions`, `area/site`, `area/non-interactive`), selecting the 10 issues with the oldest last update time.

To adapt this to your own repository:

1. Copy `gemini-issue-cleanup.yml` to your repository's `.github/workflows/` directory.
2. Update the search string in the `Find old issues for cleanup` step in `gemini-issue-cleanup.yml` to match your repository's labels.
3. Configure the `maintainers` input in `gemini-issue-cleanup.yml` (either via the workflow dispatch inputs or by setting the `MAINTAINERS` repository variable) to explicitly list which users count as maintainers for the staleness check.
4. Copy `gemini-issue-cleanup.toml` to your `.github/commands/` directory.
