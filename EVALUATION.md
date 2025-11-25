# Workspace Evaluation Framework

This document describes the evaluation framework for the `run-gemini-cli` workspace, designed to help maintain code quality, security, and best practices.

## Overview

The evaluation framework automatically assesses the health and completeness of the workspace across multiple dimensions including file structure, configuration, documentation, security, and Git status.

## Running the Evaluation

To run the evaluation framework:

```bash
npm run evaluate
```

This will:
1. Check all critical files and configurations
2. Validate security best practices
3. Assess documentation quality
4. Generate a detailed report with scores and recommendations
5. Save results to `evaluation-results.json`

## Evaluation Categories

### 1. Required Files (12 points)
Checks for the presence of essential project files:
- `package.json` (2 points)
- `action.yml` (3 points) - Core action manifest
- `README.md` (2 points)
- `LICENSE` (1 point)
- `.gitignore` (1 point)
- `CONTRIBUTING.md` (1 point)
- `GEMINI.md` (2 points) - Custom instructions for Gemini

### 2. Environment Configuration (7 points)
Validates environment setup and security:
- `.env` file exists (2 points)
- Contains `GEMINI_API_KEY` (2 points)
- Key is not a placeholder (1 point)
- `.env` is in `.gitignore` (2 points) - **Critical for security**

### 3. Action Structure (7 points)
Verifies the GitHub Action manifest is properly configured:
- Has name field (1 point)
- Has description (1 point)
- Has inputs section (2 points)
- Has runs section (2 points)
- Is composite type (1 point)

### 4. Git Status (2 points)
Checks repository health:
- Git repository initialized (1 point)
- Tracks uncommitted changes (1 point)

### 5. Documentation Quality (7 points)
Assesses README.md completeness:
- Has overview section (1 point)
- Has quick start guide (2 points)
- Has examples (2 points)
- Has configuration documentation (1 point)
- Is comprehensive (>500 words) (1 point)

### 6. Examples (6 points)
Validates example resources:
- Examples directory exists (2 points)
- Workflow examples exist (2 points)
- Contains YAML workflow files (2 points)

### 7. Dependencies (3 points)
Checks dependency management:
- `node_modules` installed (1 point)
- `package-lock.json` exists (1 point)
- Has npm scripts defined (1 point)

### 8. Security Best Practices (6 points)
Ensures sensitive files are protected:
- Environment files ignored (2 points)
- Node modules ignored (1 point)
- Gemini CLI settings ignored (1 point)
- GitHub App credentials ignored (2 points)

## Scoring System

**Total Possible Score:** 50 points

### Grading Scale
- **A (90-100%):** Excellent - Workspace is in great shape
- **B (80-89%):** Good - Minor improvements recommended
- **C (70-79%):** Fair - Some attention needed
- **D (60-69%):** Needs Improvement - Several issues to address
- **F (<60%):** Poor - Significant improvements required

## Output Files

The evaluation generates two output files:

1. **Console Output**: Real-time progress and summary
2. **`evaluation-results.json`**: Detailed JSON report with:
   - Individual check results
   - Warnings about potential issues
   - Recommendations for improvements
   - Overall score and grade

## Security Considerations

The evaluation framework:
- **Never exposes secrets** - Only checks for presence of keys, not their values
- **Validates .gitignore** - Ensures sensitive files won't be committed
- **Checks file permissions** - Verifies security best practices
- **Safe for CI/CD** - Can run in automated environments

## Integration with Development Workflow

### Pre-commit Hook
You can add this to your pre-commit workflow:

```bash
npm run evaluate || echo "⚠️  Workspace evaluation found issues"
```

### CI/CD Pipeline
Add to GitHub Actions workflow:

```yaml
- name: Evaluate Workspace
  run: npm run evaluate
```

### Manual Review
Run before:
- Creating pull requests
- Major refactoring
- Security audits
- Onboarding new contributors

## Extending the Framework

To add new checks, edit `scripts/evaluate-workspace.js`:

1. Create a new check method:
```javascript
checkNewFeature() {
  console.log('\n🔍 Checking New Feature...');
  const result = // your validation logic
  this.addCheck('Feature name', result, points);
}
```

2. Add it to the `run()` method:
```javascript
async run() {
  // ... existing checks
  this.checkNewFeature();
  // ...
}
```

## Continuous Improvement

The evaluation framework evolves with the project. As new best practices emerge or requirements change, update the checks to maintain high standards.

### Recent Updates
- Initial framework creation with 8 evaluation categories
- Added support for both single and double quotes in YAML validation
- Integrated npm script for easy access

### Future Enhancements
Consider adding:
- Linting integration (if linters are added)
- Test coverage checks (when tests are implemented)
- Performance benchmarks
- Dependency vulnerability scanning
- Action workflow validation

## Troubleshooting

### Common Issues

**Failed Check: `.env key is not placeholder`**
- Solution: Set your actual Gemini API key in `.env`

**Failed Check: `.env is in .gitignore`**
- Solution: Add `.env` to your `.gitignore` file immediately
- This is critical to prevent committing secrets

**Warning: Uncommitted changes**
- Not necessarily a problem, just informational
- Review changes and commit when ready

**Low documentation score**
- Expand README.md with more examples
- Add configuration details
- Include troubleshooting section

## Best Practices

1. **Run evaluation regularly** - Before commits and PRs
2. **Address security issues immediately** - Never skip .gitignore checks
3. **Maintain documentation** - Keep README up to date
4. **Track your score** - Aim for 90%+ consistently
5. **Review recommendations** - They're tailored to your workspace

## Support

For issues or questions about the evaluation framework:
1. Check `evaluation-results.json` for detailed diagnostics
2. Review this documentation
3. Open an issue in the repository
4. Consult the [CONTRIBUTING.md](./CONTRIBUTING.md) guide

---

**Remember:** The evaluation framework is a tool to help you maintain quality, not a strict enforcement. Use it as a guide to continuously improve your workspace.
