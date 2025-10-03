# Extensions

Gemini CLI can be extended with additional functionality through extensions.
These extensions are installed from source from their GitHub repositories.

For more information on creating and using extensions, see [documentation].

[documentation]: https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/index.md

## Configuration

To use extensions in your GitHub workflow, provide a JSON array of GitHub
repositories to the `extensions` input of the `run-gemini-cli` action.

### Example

Here is an example of how to configure a workflow to install and use extensions:

```yaml
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - id: gemini
        uses: google-github-actions/run-gemini-cli@v0
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          prompt: "/security:analyze"
          extensions: |
            [
              "https://github.com/gemini-cli-extensions/security",
              "https://github.com/gemini-cli-extensions/code-review"
            ]
```
