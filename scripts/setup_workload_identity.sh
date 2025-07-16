#!/usr/bin/env bash

# Universal Direct Workload Identity Federation Setup Script for GitHub Actions
# This script sets up Google Cloud Direct Workload Identity Federation for any GitHub repository
# to work with the google-github-actions/auth action.
# 
# Uses Direct WIF (preferred): No intermediate service accounts, direct authentication to GCP resources.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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
    echo -e "${BLUE}🚀 $1${NC}"
}

# Default values
GCP_PROJECT_ID=""
GITHUB_REPO=""
POOL_NAME="github"

# Show help
show_help() {
    cat << EOF
Universal Direct Workload Identity Federation Setup for GitHub Actions

USAGE:
    $0 --repo OWNER/REPO [OPTIONS]

REQUIRED:
    -r, --repo OWNER/REPO       GitHub repository (e.g., google/my-repo)

OPTIONS:
    -p, --project PROJECT_ID    Google Cloud project ID (auto-detected if not provided)
    --pool-name NAME           Custom workload identity pool name (default: auto-generated)
    -h, --help                 Show this help

EXAMPLES:
    # Basic setup for a repository
    $0 --repo google/my-repo

    # With specific project
    $0 --repo google/my-repo --project my-gcp-project

    # Custom pool name
    $0 --repo google/my-repo --pool-name my-pool

ABOUT DIRECT WORKLOAD IDENTITY FEDERATION:
    This script sets up Direct Workload Identity Federation (preferred method).
    - No intermediate service accounts required
    - Direct authentication from GitHub Actions to GCP resources
    - Maximum token lifetime of 10 minutes
    - You grant permissions directly to the Workload Identity Pool on GCP resources

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        -p|--project)
            GCP_PROJECT_ID="$2"
            shift 2
            ;;
        --pool-name)
            POOL_NAME="$2"
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

# Validate required arguments
if [[ -z "${GITHUB_REPO}" ]]; then
    print_error "Repository is required. Use --repo OWNER/REPO"
    echo ""
    echo "💡 To find your repository name:"
    echo "   1. Go to your GitHub repository"
    echo "   2. The URL shows: https://github.com/OWNER/REPOSITORY"
    echo "   3. Use: OWNER/REPOSITORY (e.g., google/golang)"
    echo ""
    echo "Use --help for usage information."
    exit 1
fi

# Validate repository format
if [[ ! "${GITHUB_REPO}" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
    print_error "Invalid repository format '${GITHUB_REPO}'"
    echo "Expected format: owner/repo (e.g., google/my-repo)"
    exit 1
fi

# Auto-detect project ID if not provided
if [[ -z "${GCP_PROJECT_ID}" ]]; then
    print_info "Auto-detecting Google Cloud project..."
    GCP_PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [[ -z "${GCP_PROJECT_ID}" ]]; then
        print_error "Could not auto-detect Google Cloud project ID"
        echo "Please either:"
        echo "  1. Set default project: gcloud config set project YOUR_PROJECT_ID"
        echo "  2. Use --project flag: $0 --repo ${GITHUB_REPO} --project YOUR_PROJECT_ID"
        exit 1
    fi
    print_success "Using project: ${GCP_PROJECT_ID}"
fi

# Extract repository components
REPO_OWNER=$(echo "${GITHUB_REPO}" | cut -d'/' -f1)

# Generate unique names based on repository
REPO_HASH_INPUT=$(echo -n "${GITHUB_REPO}")
REPO_HASH_SHA=$(echo "${REPO_HASH_INPUT}" | shasum -a 256)
REPO_HASH=$(echo "${REPO_HASH_SHA}" | cut -c1-8)
POOL_NAME="github-${REPO_HASH}"
PROVIDER_NAME="gh-${REPO_HASH}"

print_header "Starting Direct Workload Identity Federation setup"
echo "📦 Repository: ${GITHUB_REPO}"
echo "☁️ Project: ${GCP_PROJECT_ID}"
echo "🏊 Pool: ${POOL_NAME}"
echo "🆔 Provider: ${PROVIDER_NAME}"
echo ""

# Verify gcloud authentication
print_info "Verifying gcloud authentication..."
GCLOUD_AUTH_LIST_RAW=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
GCLOUD_AUTH_LIST=$(echo "${GCLOUD_AUTH_LIST_RAW}" | head -1)
if [[ -z "${GCLOUD_AUTH_LIST}" ]]; then
    print_error "No active gcloud authentication found"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Test project access
if ! gcloud projects describe "${GCP_PROJECT_ID}" > /dev/null 2>&1; then
    print_error "Cannot access project '${GCP_PROJECT_ID}'"
    echo "Please verify:"
    echo "  1. Project ID is correct"
    echo "  2. You have permissions on this project"
    echo "  3. Project exists and is not deleted"
    exit 1
fi

print_success "Authentication and project access verified"

# Step 1: Enable required APIs
print_header "Step 1: Enabling required Google Cloud APIs"
apis_to_enable="iamcredentials.googleapis.com cloudresourcemanager.googleapis.com iam.googleapis.com sts.googleapis.com logging.googleapis.com monitoring.googleapis.com cloudtrace.googleapis.com"

print_info "Enabling APIs: ${apis_to_enable}"
gcloud services enable "${apis_to_enable}" --project="${GCP_PROJECT_ID}"
print_success "APIs enabled successfully"

# Step 2: Create Workload Identity Pool
print_header "Step 2: Creating Workload Identity Pool"
if ! gcloud iam workload-identity-pools describe "${POOL_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --location="global" &> /dev/null; then
    print_info "Creating Workload Identity Pool: ${POOL_NAME}"
    gcloud iam workload-identity-pools create "${POOL_NAME}" \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --display-name="GitHub Actions Pool"
    print_success "Workload Identity Pool created"
else
    print_success "Workload Identity Pool already exists"
fi

# Get the pool ID
WIF_POOL_ID=$(gcloud iam workload-identity-pools describe "${POOL_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --location="global" \
    --format="value(name)")

# Step 3: Create Workload Identity Provider
print_header "Step 3: Creating Workload Identity Provider"
ATTRIBUTE_CONDITION="assertion.repository_owner == '${REPO_OWNER}'"

if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_NAME}" &> /dev/null; then
    print_info "Creating Workload Identity Provider: ${PROVIDER_NAME}"
    gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
        --project="${GCP_PROJECT_ID}" \
        --location="global" \
        --workload-identity-pool="${POOL_NAME}" \
        --display-name="${PROVIDER_NAME}" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
        --attribute-condition="${ATTRIBUTE_CONDITION}" \
        --issuer-uri="https://token.actions.githubusercontent.com"
    print_success "Workload Identity Provider created"
else
    print_success "Workload Identity Provider already exists"
fi

# Step 4: Grant standard permissions to the Workload Identity Pool
print_header "Step 4: Granting standard permissions to Workload Identity Pool"
PRINCIPAL_SET="principalSet://iam.googleapis.com/${WIF_POOL_ID}/attribute.repository/${GITHUB_REPO}"

print_info "Granting standard CI/CD permissions directly to the Workload Identity Pool..."

# Core observability permissions
print_info "Granting logging permissions..."
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --role="roles/logging.logWriter" \
    --member="${PRINCIPAL_SET}" \
    --condition=None

print_info "Granting monitoring permissions..."
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --role="roles/monitoring.editor" \
    --member="${PRINCIPAL_SET}" \
    --condition=None

print_info "Granting tracing permissions..."
gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --role="roles/cloudtrace.agent" \
    --member="${PRINCIPAL_SET}" \
    --condition=None

print_success "Standard permissions granted to Workload Identity Pool"

# Get the full provider name for output
WIF_PROVIDER_FULL=$(gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
    --project="${GCP_PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_NAME}" \
    --format="value(name)")

# Step 5: Output configuration
print_header "🎉 Setup Complete!"
echo ""
print_success "Direct Workload Identity Federation has been configured for your repository!"
echo ""

print_header "Permissions Granted"
echo ""
print_success "The following permissions have been automatically granted to your repository:"
echo "• roles/logging.logWriter - Write logs to Cloud Logging"
echo "• roles/monitoring.editor - Create and update metrics in Cloud Monitoring"
echo "• roles/cloudtrace.agent - Send traces to Cloud Trace"
echo ""

print_header "GitHub Environment Variables Configuration"
echo ""
print_warning "Add these variables to your GitHub repository or workflow configuration:"
echo "  Repository: https://github.com/${GITHUB_REPO}/settings/variables/actions"
echo ""
echo "🔑 Variable Name: OTLP_GCP_WIF_PROVIDER"
echo "   Value: ${WIF_PROVIDER_FULL}"
echo ""
echo "☁️  Variable Name: OTLP_GOOGLE_CLOUD_PROJECT"
echo "   Value: ${GCP_PROJECT_ID}"
echo ""

print_success "Setup completed successfully! 🚀"
