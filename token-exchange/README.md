# Token exchange server

A token exchange server can be deployed to issue app installation tokens for
a GitHub app from an arbitrary GitHub workflow.

The following instructions set up a token exchange service on Google Cloud.

## Create a GitHub app

[Create a GitHub app](https://github.com/settings/apps/new), saving its app ID
as `$GITHUB_APP_ID`.

## Set up infrastructure

Create a new GCP project, save the project ID as `$PROJECT_ID`.

Authenticate application default credentials (used by Terraform).

```sh
gcloud auth application-default login
```

Apply the Terraform to create the infrastructure.

```sh
terraform apply -var="project_id=${PROJECT_ID?}" -var="github_app_id=${GITHUB_APP_ID?}"
```

## Create a GitHub app private key

Create a new private key in the GitHub app. This will create a file in your
downloads folder.

Push the private key to Secret Manager using the following:

```sh
gcloud --project ${PROJECT_ID?} secrets versions add github-app-private-key --data-file [private key .pem file]
```

## Deploy server

Run the workflow "Deploy token exchange" to build and deploy the service to
Cloud Run.

## Add a permissions authorization file to your repo.

The repo running the below workflow must have a permissions authorization file
at the location `.gemini/run-gemini-cli-auth.yaml`:

```yaml
version: minty.abcxyz.dev/v2

scope:
  triage-issues:
    repositories:
      - [your own repo as `owner/repo`]
    permissions:
      contents: read
      issues: write
  code-review:
    repositories:
      - [your own repo as `owner/repo`]
    permissions:
      contents: read
      pull_requests: write
```

## Use the token exchange in your workflow

The following workflow will exchange the token.

```yaml
  exchange-token:

      runs-on: ubuntu-latest
      permissions:
          contents: 'read'
          id-token: 'write'

      env:
        # These values match PROJECT_ID above (look up the corresponding project number).
        project_id: 'some-project'
        project_number: '123456789'
        location: 'us-central1'

        workload_identity_provider: 'projects/${{env.project_number}}/locations/global/workloadIdentityPools/token-exchange/providers/github-actions'
        service_invoker: 'token-exchange-invoker@${{env.project_id}}.iam.gserviceaccount.com'
        service_url: 'https://github-token-exchange-${{env.project_number}}.${{env.location}}.run.app'

      steps:

        - id: 'minty-auth'
          uses: 'google-github-actions/auth@6fc4af4b145ae7821d527454aa9bd537d1f2dc5f' # v2
          with:
            create_credentials_file: false
            export_environment_variables: false
            workload_identity_provider: '${{ env.workload_identity_provider }}'
            service_account: '${{ env.service_invoker }}'
            audience: 'https://iam.googleapis.com/${{ env.workload_identity_provider}}'
            token_format: 'id_token'
            id_token_audience: '${{ env.service_url }}'
            id_token_include_email: true

        - id: 'mint-token'
          uses: 'abcxyz/github-token-minter/.github/actions/minty@bff0776c3a11ddee36c5b9fc72299bd35994a075' # v2.3.2
          with:
            id_token: '${{ steps.minty-auth.outputs.id_token }}'
            service_url: '${{ env.service_url }}'
            # The `scope` below matches an entry from the `.gemini/run-gemini-cli-auth.yaml` file.
            requested_permissions: |-
              {
                "scope": "triage-issues"
              }

        - name: 'run-gh-with-exchanged-token'
          env:
            GH_TOKEN: ${{ steps.mint-token.outputs.token }}
          run: |
            gh <some-command>
```
