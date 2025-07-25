#!/usr/bin/env bash

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

# AlloyDB Setup Script
# This script automates the setup of a Google Cloud AlloyDB cluster and instance.

set -e

# --- Colors for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Helper functions ---
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}======================================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}======================================================================${NC}"
}

# --- Default values ---
PROJECT_ID="gc-demo-463422"
REGION="us-central1"
CLUSTER="issues-embeddings-cluster"
INSTANCE="primary-instance"
DB_NAME="postgres"
DB_PASSWORD=""
VPC_NETWORK="default"
SERVICE_ACCOUNT=""
PRINCIPAL_SET=""
IP_ADDRESS=""

# --- Show help ---
show_help() {
    cat << EOF
AlloyDB Setup Script

This script sets up a new AlloyDB cluster, a primary instance, and configures it for use.

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -p, --project PROJECT_ID    Google Cloud project ID (default: ${PROJECT_ID})
    -r, --region REGION         Google Cloud region for the AlloyDB cluster (default: ${REGION})
    -c, --cluster NAME          AlloyDB cluster name (default: ${CLUSTER})
    -i, --instance NAME         AlloyDB primary instance name (default: ${INSTANCE})
    -n, --network NAME          VPC network to use (default: ${VPC_NETWORK})
    --db-name DBNAME            Name for the initial database (default: ${DB_NAME})
    --db-password PASSWORD      Required: Password for the 'postgres' user
    -s, --service-account NAME  Service account to create and/or grant AlloyDB client role
    --principal-set PRINCIPAL   Workload Identity Federation principalSet (eg. principalSet://iam.googleapis.com/..)
    --ip-address CIDR           Optional: Public IP address range (CIDR) to allow connections from.
    -h, --help                  Show this help

EXAMPLES:
    # Run with default settings (recommended)
    $0

    # Specify a different project and region
    $0 --project my-other-project --region us-east1

    # Create a service account and grant it access
    $0 --service-account my-service-account

    # Use Workload Identity Federation
    $0 --service-account my-sa --principal-set "principal://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/my-pool/subject/my-subject"
EOF
}

# --- Parse command line arguments ---
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)
            PROJECT_ID="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -c|--cluster)
            CLUSTER="$2"
            shift 2
            ;;
        -i|--instance)
            INSTANCE="$2"
            shift 2
            ;;
        -n|--network)
            VPC_NETWORK="$2"
            shift 2
            ;;
        --db-name)
            DB_NAME="$2"
            shift 2
            ;;
        --db-password)
            DB_PASSWORD="$2"
            shift 2
            ;;
        -s|--service-account)
            SERVICE_ACCOUNT="$2"
            shift 2
            ;;
        --principal-set)
            PRINCIPAL_SET="$2"
            shift 2
            ;;
        --ip-address)
            IP_ADDRESS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# --- Initial validation and configuration ---
print_header "Starting AlloyDB Setup"

# Validate required arguments
if [[ -z "${DB_PASSWORD}" ]]; then
    print_error "Default 'postgres' user password (--db-password) is required."
    exit 1
fi

# Check for required arguments based on IP address presence
if [[ -z "${IP_ADDRESS}" && -z "${SERVICE_ACCOUNT}" ]]; then
    print_error "When no public IP address is specified (--ip-address), a service account (--service-account) must be provided for authentication via the AlloyDB Auth Proxy."
    exit 1
fi

# Auto-detect project ID if not provided via flag or default
if [[ -z "${PROJECT_ID}" ]]; then
    print_info "Auto-detecting Google Cloud project..."
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [[ -z "${PROJECT_ID}" ]]; then
        print_error "Could not auto-detect Google Cloud project ID."
        echo "Please use the --project flag or run 'gcloud config set project YOUR_PROJECT_ID'"
        exit 1
    fi
fi

# Print configuration that will be used
echo "Using the following configuration:"
echo "  ☁️ Project:         ${PROJECT_ID}"
echo "  📍 Region:          ${REGION}"
echo "  🔗 VPC Network:     ${VPC_NETWORK}"
echo "  🗄️  Cluster Name:    ${CLUSTER}"
echo "  🖥️  Instance Name:   ${INSTANCE}"
echo "  💾 Database Name:   ${DB_NAME}"
if [[ -n "${SERVICE_ACCOUNT}" ]]; then
    echo "  👤 Service Account: ${SERVICE_ACCOUNT}"
    if [[ -n "${PRINCIPAL_SET}" ]]; then
        echo "  🌍 Principal Set:   ${PRINCIPAL_SET}"
    fi
fi
echo ""

# Verify gcloud authentication
print_info "Verifying gcloud authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q '.'; then
    print_error "No active gcloud authentication found. Please run 'gcloud auth login'."
    exit 1
fi

# Test project access
if ! gcloud projects describe "${PROJECT_ID}" > /dev/null 2>&1; then
    print_error "Cannot access project '${PROJECT_ID}'. Please verify the ID and your permissions."
    exit 1
fi
print_success "Authentication and project access verified."


# --- Step 1: Enable required APIs ---
print_header "Step 1: Enabling required Google Cloud APIs"
apis_to_enable=(
    "alloydb.googleapis.com"
    "compute.googleapis.com"
    "servicenetworking.googleapis.com"
    "cloudresourcemanager.googleapis.com"
    "iam.googleapis.com"
)

print_info "Checking and enabling APIs: ${apis_to_enable[*]}"
gcloud services enable "${apis_to_enable[@]}" --project="${PROJECT_ID}"
print_success "APIs enabled successfully."


# --- Step 2: Configure Service Account (if specified) ---
if [[ -n "${SERVICE_ACCOUNT}" ]]; then
    print_header "Step 2: Configuring Service Account"
    SA_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
    
    print_info "Checking if service account '${SERVICE_ACCOUNT}' exists..."
    if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" &> /dev/null; then
        print_warning "Service account not found. Creating it..."
        gcloud iam service-accounts create "${SERVICE_ACCOUNT}" \
            --display-name="${SERVICE_ACCOUNT}" \
            --project="${PROJECT_ID}"
        print_success "Service account '${SERVICE_ACCOUNT}' created."
    else
        print_success "Service account '${SERVICE_ACCOUNT}' already exists."
    fi

    print_info "Assigning 'roles/serviceusage.serviceUsageConsumer' to service account..."
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/serviceusage.serviceUsageConsumer" --quiet --condition=None > /dev/null
    print_success "Role 'roles/serviceusage.serviceUsageConsumer' assigned."

    print_info "Assigning 'roles/alloydb.client' to service account..."
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/alloydb.client" --quiet --condition=None > /dev/null
    print_success "Role 'roles/alloydb.client' assigned."

    print_info "Assigning 'roles/alloydb.databaseUser' to service account..."
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/alloydb.databaseUser" --quiet --condition=None > /dev/null
    print_success "Role 'roles/alloydb.databaseUser' assigned."

    print_info "Assigning 'roles/iam.serviceAccountTokenCreator' to service account on itself..."
    gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
        --project="${PROJECT_ID}" \
        --role="roles/iam.serviceAccountTokenCreator" \
        --member="serviceAccount:${SA_EMAIL}" --quiet --condition=None > /dev/null
    print_success "Role 'roles/iam.serviceAccountTokenCreator' assigned."

    if [[ -n "${PRINCIPAL_SET}" ]]; then
        print_info "Assigning 'roles/iam.workloadIdentityUser' to principal set..."
        gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
            --project="${PROJECT_ID}" \
            --role="roles/iam.workloadIdentityUser" \
            --member="${PRINCIPAL_SET}" --quiet > /dev/null
        print_success "Workload Identity User role granted to principal."
    else
        print_info "No workload identify federation principal set specified, skipping role assignment."
    fi
else
    print_info "No service account specified, skipping service account configuration."
fi

# --- Step 3: Create AlloyDB Cluster ---
print_header "Step 3: Creating AlloyDB Cluster"
if ! gcloud alloydb clusters describe "${CLUSTER}" --region="${REGION}" --project="${PROJECT_ID}" &> /dev/null; then
    print_info "Creating AlloyDB cluster '${CLUSTER}'..."
    gcloud alloydb clusters create "${CLUSTER}" \
        --password="${DB_PASSWORD}" \
        --region="${REGION}" \
        --network="${VPC_NETWORK}" \
        --project="${PROJECT_ID}"
    print_success "AlloyDB cluster created."
else
    print_success "AlloyDB cluster '${CLUSTER}' already exists."
fi


# --- Step 4: Create Primary AlloyDB Instance ---
print_header "Step 4: Creating Primary AlloyDB Instance"
if ! gcloud alloydb instances describe "${INSTANCE}" --cluster="${CLUSTER}" --region="${REGION}" --project="${PROJECT_ID}" &> /dev/null; then
    print_info "Creating primary instance '${INSTANCE}'. This may take a few minutes..."
    
    INSTANCE_CREATE_CMD=(gcloud alloydb instances create "${INSTANCE}"
        --cluster="${CLUSTER}"
        --region="${REGION}"
        --instance-type=PRIMARY
        --cpu-count=2
        --project="${PROJECT_ID}"
        --availability-type=ZONAL
        --assign-inbound-public-ip=ASSIGN_IPV4
    )

    # Add public IP configuration if specified
    if [[ -n "${IP_ADDRESS}" ]]; then
        print_warning "Assigning a public IP and allowing access from '${IP_ADDRESS}'."
        INSTANCE_CREATE_CMD+=(
            --authorized-external-networks="${IP_ADDRESS}"
        )
    else
        print_info "No public IP address specified. The instance will only be accessible within the VPC."
    fi

    # Enable IAM database authentication if a service account email is provided
    if [[ -n "${SA_EMAIL}" ]]; then
        print_info "Enabling IAM database authentication for the instance."
        INSTANCE_CREATE_CMD+=(
            "--database-flags=password.enforce_complexity=on,alloydb.iam_authentication=on"
        )
    else
        INSTANCE_CREATE_CMD+=(
            "--database-flags=password.enforce_complexity=on"
        )
    fi

    # Execute the create command
    "${INSTANCE_CREATE_CMD[@]}"
    print_success "Primary instance created."
else
    print_success "Primary instance '${INSTANCE}' already exists."
    # Note: This script doesn't modify the flags of an existing instance.
    # If the instance exists but doesn't have IAM auth enabled, you would need to run
    # 'gcloud alloydb instances update' to add the database flag.
fi

# Add the service account as an IAM database user if specified
if [[ -n "${SA_EMAIL}" ]]; then
    print_header "Step 4.1: Granting Service Account IAM Database Access"
    if ! gcloud alloydb users list --filter=name:"${SA_EMAIL}" --cluster="${CLUSTER}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(name)" | grep -q '.'; then
        print_info "Granting IAM database access to service account '${SA_EMAIL}'..."
        gcloud alloydb users create "${SA_EMAIL}" \
            --cluster="${CLUSTER}" \
            --region="${REGION}" \
            --project="${PROJECT_ID}" \
            --type=IAM_BASED \
            --db-roles=postgres
        print_success "IAM user for service account created."
    else
        print_success "IAM user for '${SA_EMAIL}' already exists."
    fi
fi

# --- Step 5: Final Output ---
print_header "🎉 Setup Complete! 🎉"

print_info "Fetching instance IP address..."
INSTANCE_IP=$(gcloud alloydb instances describe "${INSTANCE}" --cluster="${CLUSTER}" --region="${REGION}" --project="${PROJECT_ID}" --format='value(publicIpAddress)')

if [[ -z "${INSTANCE_IP}" ]]; then
    print_error "Could not retrieve the instance IP address."
    exit 1
fi

echo ""
print_success "Setup completed successfully!"


# --- Step 6: Output Configuration ---
print_header "Output Settings:"
echo "  PROJECT_ID: ${PROJECT_ID}"
echo "  REGION: ${REGION}"
echo "  CLUSTER_ID: ${CLUSTER}"
echo "  INSTANCE_ID: ${INSTANCE}"
echo "  DATABASE_NAME: ${DB_NAME}"
echo "  DB_USER: postgres"
echo "  INSTANCE_HOST: ${INSTANCE_IP}"
echo ""

if [[ -n "${IP_ADDRESS}" ]]; then
    print_info "Access configured to allow connections from IP address ${IP_ADDRESS}"
else
    print_info "Connect using AlloyDB proxy through service account ${SA_EMAIL}"
fi

echo ""
print_success "All steps completed!"
