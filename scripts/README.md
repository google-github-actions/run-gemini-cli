# Scripts Directory

This directory contains utility scripts for the `run-gemini-cli` project.

## Available Scripts

### evaluate-workspace.js

**Purpose:** Comprehensive workspace evaluation framework that assesses code quality, security, and best practices.

**Usage:**
```bash
npm run evaluate
```

**Features:**
- ✅ Validates required files and structure
- 🔒 Checks security configurations
- 📝 Assesses documentation quality
- 🔍 Examines Git status
- 📊 Generates detailed reports with scores

**Output:**
- Console: Real-time progress and summary
- `evaluation-results.json`: Detailed JSON report

**Score:** 50 points maximum across 8 categories

See [EVALUATION.md](../EVALUATION.md) for complete documentation.

### Other Scripts

#### collector-gcp.yaml.template
Template for Google Cloud Platform observability collector configuration.

#### generate-examples.sh
Generates example workflow files (bash script).

#### setup_workload_identity.sh
Sets up Google Cloud Workload Identity Federation for secure authentication (bash script).

## Quick Start

1. **Run evaluation:**
   ```bash
   npm run evaluate
   ```

2. **Check results:**
   ```bash
   cat evaluation-results.json
   ```

3. **Review recommendations:**
   The evaluation will provide specific recommendations based on your workspace state.

## Development

When adding new scripts:
1. Make them executable: `chmod +x script-name.sh`
2. Add usage documentation to this README
3. Update package.json scripts if they should be npm runnable
4. Consider cross-platform compatibility (Windows/Linux/macOS)

## Notes

- The evaluation framework keeps your `.env` file safe - it never exposes secrets
- All scripts respect `.gitignore` and won't commit sensitive data
- Run `npm run evaluate` before creating PRs to ensure quality standards
