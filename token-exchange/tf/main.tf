# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

provider "google" {
  project = var.project_id
  region  = var.location
}

resource "google_project_service" "default" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "logging.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])

  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

// Define service accounts.

resource "google_service_account" "invoker_service_account" {
  account_id   = "token-exchange-invoker"
  display_name = "Token Exchange Invoker"
  description  = "Service account for invoking the token exchange service, accessible by all GitHub Actions workflows."
}

resource "google_service_account" "run_service_account" {
  account_id   = "token-exchange-service"
  display_name = "Token Exchange Service"
  description  = "Service account for the Cloud Run service, used to read the GitHub App private key from Secret Manager."
}


resource "google_service_account" "deployer_service_account" {
  account_id   = "token-exchange-deployer"
  display_name = "Token Exchange Deployer"
  description  = "Service account for deploying the token exchange service from GitHub Actions, only accessible by the GitHub Actions CI pipeline."
}

// Create the GitHub App private key secret in Secret Manager.

resource "google_secret_manager_secret" "github_app_private_key" {
  depends_on = [google_project_service.default]
  secret_id  = "github-app-private-key"
  replication {
    user_managed {
      replicas {
        location = var.location
      }
    }
  }
}

resource "google_secret_manager_secret_version" "github_app_private_key" {
  secret = google_secret_manager_secret.github_app_private_key.id
  lifecycle {
    ignore_changes = [
      secret_data,
    ]
  }
  // Secret will be added later.
}

resource "google_secret_manager_secret_iam_member" "run_secret_accessor" {
  secret_id = google_secret_manager_secret.github_app_private_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run_service_account.email}"
}

// Create Cloud Run service with a temporary container image.
// Actual image will be deployed by the CI pipeline.

resource "google_cloud_run_v2_service" "token_exchange" {
  depends_on = [
    google_project_service.default,
    google_secret_manager_secret_version.github_app_private_key,
    google_secret_manager_secret_iam_member.run_secret_accessor,
  ]

  name     = "github-token-exchange"
  location = var.location
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run_service_account.email
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
    containers {
      command = ["minty", "server", "run"]
      image   = "us-docker.pkg.dev/cloudrun/container/hello"
      env {
        name  = "GITHUB_APP_ID"
        value = var.github_app_id
      }
      env {
        name = "GITHUB_PRIVATE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.github_app_private_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "CONFIG_CACHE_MINUTES"
        value = tostring(var.config_cache_minutes)
      }
      env {
        name  = "REPO_CONFIG_PATH"
        value = var.config_path
      }
      env {
        name  = "ORG_CONFIG_PATH"
        value = ".does-not-exist" # TODO
      }
      env {
        name  = "ORG_CONFIG_REPO"
        value = ".does-not-exist" # TODO
      }
      env {
        name  = "ISSUER_ALLOWLIST"
        value = "https://token.actions.githubusercontent.com"
      }
    }
  }
}

resource "google_artifact_registry_repository" "token_exchange_images" {
  location      = var.location
  repository_id = "token-exchange-images"
  format        = "DOCKER"
}

resource "google_project_iam_member" "deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deployer_service_account.email}"
}

resource "google_cloud_run_service_iam_member" "invoker_binding" {
  service = google_cloud_run_v2_service.token_exchange.name
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.invoker_service_account.email}"
}

resource "google_cloud_run_service_iam_member" "deployer_run_deployer" {
  service = google_cloud_run_v2_service.token_exchange.name
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer_service_account.email}"
}

// Allow the deployer to actAs the Cloud Run runtime service account so it can deploy the service.
resource "google_service_account_iam_member" "deployer_sa_user_binding" {
  service_account_id = google_service_account.run_service_account.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer_service_account.email}"
}

// Workload pool for CI pipeline

resource "google_iam_workload_identity_pool" "ci_pipeline" {
  depends_on                = [google_project_service.default]
  workload_identity_pool_id = "ci-pipeline"
}

resource "google_iam_workload_identity_pool_provider" "ci_pipeline_github_actions" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.ci_pipeline.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions CI Pipeline"
  description                        = "Workload identity pool provider for deploying the token exchange service from GitHub Actions."
  attribute_condition                = <<EOT
    assertion.repository == "${var.github_ci_repo}"
EOT
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.aud"        = "assertion.aud"
    "attribute.owner"      = "assertion.repository_owner"
    "attribute.repository" = "assertion.repository"
  }
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "ci_pipeline_service_account_binding" {
  service_account_id = google_service_account.deployer_service_account.id
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.ci_pipeline.name}/*"
}

// Workload pool for token exchange

resource "google_iam_workload_identity_pool" "token_exchange" {
  depends_on                = [google_project_service.default]
  workload_identity_pool_id = "token-exchange"
}

resource "google_iam_workload_identity_pool_provider" "token_exchange_github_actions" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.token_exchange.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions Token Exchange"
  description                        = "Workload identity pool provider for token exchange for arbitary GitHub Actions workflows."

  attribute_condition = <<EOT
    assertion.iss == "https://token.actions.githubusercontent.com"
  EOT
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.aud"        = "assertion.aud"
    "attribute.owner"      = "assertion.repository_owner"
    "attribute.repository" = "assertion.repository"
  }
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "token_exchange_service_account_binding" {
  service_account_id = google_service_account.invoker_service_account.id
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.token_exchange.name}/*"
}
