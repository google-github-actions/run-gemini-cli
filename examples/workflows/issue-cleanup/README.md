# Issue Cleanup Workflow

This document describes a workflow to batch-process and clean up older open issues using Gemini CLI.

## Overview

The Issue Cleanup workflow is designed to automate the triage of stale issues by using the Gemini CLI to:

1. **Check Code Validity**: Determines if an issue is still relevant against the current codebase. If the issue has already been resolved implicitly, it will close the issue with an explanation.
2. **Find Duplicates**: Checks if the issue has a more recent duplicate. If a duplicate exists, it closes the issue and links to the duplicate.
3. **Summarize for Triage**: If an issue is still valid and unique, it provides a summary comment categorizing it as either `Maintainer-only` (epic, sensitive, internal) or `Help-wanted` (community-friendly).

## Usage

This example is tailored to process issues in a specific repository (`google-gemini/gemini-cli`) matching specific labels (`area/core`, `area/extensions`, `area/site`, `area/non-interactive`), selecting the 10 issues with the oldest last update time.

To adapt this to your own repository:

1. Copy `gemini-issue-cleanup.yml` to your repository's `.github/workflows/` directory.
2. Update the repository name and search string in the `Find old issues for cleanup` step in `gemini-issue-cleanup.yml`.
3. Update the repository name in the `Checkout Target Repository Code` step in `gemini-issue-cleanup.yml`.
4. Copy `gemini-issue-cleanup.toml` to your `.github/commands/` directory.
5. Update the prompt instructions in `gemini-issue-cleanup.toml` replacing `google-gemini/gemini-cli` with your repository name.
