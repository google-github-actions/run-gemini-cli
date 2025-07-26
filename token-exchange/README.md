# Token exchange server

A token exchange server can be deployed to issue app installation tokens for
a GitHub app from an arbitrary GitHub workflow.

The following instructions set up a token exchange service on Google Cloud.

## Create a GitHub app

[Create a GitHub app](https://github.com/settings/apps/new), saving its app ID as `$GITHUB_APP_ID`.

## Set up infrastructure

Create a new GCP project, save the project ID as `$PROJECT_ID`.

Authenticate application default credentials (used by Terraform).

```sh
gcloud auth application-default login
```

Apply the Terraform to create the infrastructure.

```sh
terraform apply -var="project_id=${PROJECT_ID?}" -var "github_app_id=${GITHUB_APP_ID?}"
```

## Create a GitHub app private key

Create a new private key (i.e, a "client secret") in the GitHub app.

Push the private key to Secret Manager using the following:

```sh
echo -n "${GITHUB_APP_PRIVATE_KEY?}" | gcloud --project ${PROJECT_ID?} secrets versions add github-app-private-key --data-file="-"
```

## Deploy server

Run the workflow "Deploy token exchange" to build and deploy the service to
Cloud Run.
