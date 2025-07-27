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

variable "project_id" {
  description = "The GCP project ID."
  type        = string
}

variable "location" {
  description = "The location for the Cloud Run service."
  type        = string
  default     = "us-central1"
}

variable "github_app_id" {
  description = "The GitHub App ID to use for the token exchange service."
  type        = string
}

variable "github_ci_repo" {
  description = "The GitHub repository name to use for the CI pipeline to deploy the token exchange service (e.g., 'some-org/some-repo')."
  type = string
  default = "squee1945/run-gemini-cli"
}

variable "config_path" {
  description = "The path in the repository to the config file to control the permissions for the token exchange."
  type        = string
  default     = ".gemini/run-gemini-cli-auth.yaml"
}

variable "config_cache_minutes" {
  description = "The number of minutes to cache the user's config file."
  type        = number
  default     = 0
}

