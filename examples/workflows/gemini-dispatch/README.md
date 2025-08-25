# Gemini Dispatch Workflow

This workflow acts as a central dispatcher for Gemini CLI, routing requests to the appropriate workflow based on the triggering event and the command provided in the comment.

- [Gemini Dispatch Workflow](#gemini-dispatch-workflow)
  - [Triggers](#triggers)
  - [Dispatch Logic](#dispatch-logic)
  - [In-Built Workflows](#in-built-workflows)
  - [Adding Your Own Workflows](#adding-your-own-workflows)
  - [Usage](#usage)

## Triggers

This workflow is triggered by the following events:

*   Pull request review comment (created)
*   Pull request review (submitted)
*   Pull request (opened)
*   Issue (opened, reopened)
*   Issue comment (created)

## Dispatch Logic

The workflow uses a dispatch job to determine which command to execute based on the following logic:

*   If a comment contains `@gemini-cli /review`, it calls the `gemini-review.yml` workflow.
*   If a comment contains `@gemini-cli /triage`, it calls the `gemini-triage.yml` workflow.
*   If a comment contains `@gemini-cli` (without a specific command), it calls the `gemini-invoke.yml` workflow.
*   When a new pull request is opened, it calls the `gemini-review.yml` workflow.
*   When a new issue is opened or reopened, it calls the `gemini-triage.yml` workflow.

## In-Built Workflows

*   **[gemini-review.yml](../pr-review/gemini-review.yml):** This workflow reviews a pull request.
*   **[gemini-triage.yml](../issue-triage/gemini-triage.yml):** This workflow triages an issue.
*   **[gemini-invoke.yml](../gemini-assistant/gemini-invoke.yml):** This workflow is a general-purpose workflow that can be used to perform various tasks.

## Adding Your Own Workflows

You can easily extend the dispatch workflow to include your own custom workflows. Here's how:

1.  **Create your workflow file:** Create a new YAML file in the `.github/workflows` directory with your custom workflow logic. Make sure your workflow is designed to be called by `workflow_call`.
2.  **Define a new command:** Decide on a new command to trigger your workflow, for example, `@gemini-cli /my-command`.
3.  **Update the `dispatch` job:** In `gemini-dispatch.yml`, add a new condition to the `if` statement in the `dispatch` job to recognize your new command. 
4.  **Add a new job to call your workflow:** Add a new job to `gemini-dispatch.yml` that calls your custom workflow file.

## Usage

To use this workflow, simply trigger one of the events listed above. For comment-based triggers, make sure the comment starts with `@gemini-cli` and the appropriate command.
