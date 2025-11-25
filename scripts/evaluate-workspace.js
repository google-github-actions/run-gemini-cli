#!/usr/bin/env node

/**
 * Evaluation Framework for run-gemini-cli workspace
 * 
 * This script evaluates the health, completeness, and quality of the workspace.
 * It checks for common issues and provides recommendations for improvement.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class WorkspaceEvaluator {
  constructor() {
    this.results = {
      score: 0,
      maxScore: 0,
      checks: [],
      warnings: [],
      recommendations: []
    };
  }

  // Helper to add a check result
  addCheck(name, passed, points = 1, details = '') {
    this.results.maxScore += points;
    if (passed) {
      this.results.score += points;
    }
    this.results.checks.push({
      name,
      passed,
      points,
      maxPoints: points,
      details
    });
  }

  // Helper to add a warning
  addWarning(message) {
    this.results.warnings.push(message);
  }

  // Helper to add a recommendation
  addRecommendation(message) {
    this.results.recommendations.push(message);
  }

  // Check if required files exist
  checkRequiredFiles() {
    console.log('\n🔍 Checking Required Files...');
    
    const requiredFiles = [
      { path: 'package.json', points: 2 },
      { path: 'action.yml', points: 3 },
      { path: 'README.md', points: 2 },
      { path: 'LICENSE', points: 1 },
      { path: '.gitignore', points: 1 },
      { path: 'CONTRIBUTING.md', points: 1 },
      { path: 'GEMINI.md', points: 2 }
    ];

    requiredFiles.forEach(file => {
      const exists = fs.existsSync(file.path);
      this.addCheck(
        `File exists: ${file.path}`,
        exists,
        file.points,
        exists ? 'Found' : 'Missing'
      );
    });
  }

  // Check environment configuration
  checkEnvironment() {
    console.log('\n🔍 Checking Environment Configuration...');
    
    // Check .env file
    const envExists = fs.existsSync('.env');
    this.addCheck('.env file exists', envExists, 2);
    
    if (envExists) {
      const envContent = fs.readFileSync('.env', 'utf-8');
      const hasApiKey = envContent.includes('GEMINI_API_KEY=');
      this.addCheck('.env has GEMINI_API_KEY', hasApiKey, 2);
      
      // Check if the key is not a placeholder
      const isNotPlaceholder = !envContent.match(/GEMINI_API_KEY=(your-api-key|xxx|placeholder)/i);
      this.addCheck('.env key is not placeholder', isNotPlaceholder, 1);
    }
    
    // Check .gitignore for .env
    const gitignoreContent = fs.readFileSync('.gitignore', 'utf-8');
    const envIgnored = gitignoreContent.includes('.env');
    this.addCheck('.env is in .gitignore', envIgnored, 2, 'Protects secrets');
    
    if (!envIgnored) {
      this.addWarning('⚠️  .env file is not in .gitignore! This is a security risk.');
      this.addRecommendation('Add .env to .gitignore to prevent committing secrets');
    }
  }

  // Check action.yml structure
  checkActionYml() {
    console.log('\n🔍 Checking action.yml Structure...');
    
    try {
      const actionYml = fs.readFileSync('action.yml', 'utf-8');
      
      // Basic structure checks
      const hasName = actionYml.includes('name:');
      const hasDescription = actionYml.includes('description:');
      const hasInputs = actionYml.includes('inputs:');
      const hasRuns = actionYml.includes('runs:');
      
      this.addCheck('action.yml has name', hasName, 1);
      this.addCheck('action.yml has description', hasDescription, 1);
      this.addCheck('action.yml has inputs', hasInputs, 2);
      this.addCheck('action.yml has runs section', hasRuns, 2);
      
      // Check for composite action (handle both quote styles)
      const isComposite = actionYml.includes('using: "composite"') || actionYml.includes("using: 'composite'");
      this.addCheck('action.yml is composite type', isComposite, 1);
      
    } catch (error) {
      this.addWarning(`Failed to parse action.yml: ${error.message}`);
    }
  }

  // Check Git status
  checkGitStatus() {
    console.log('\n🔍 Checking Git Status...');
    
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
      this.addCheck('Git repository initialized', !!branch, 1);
      
      console.log(`   Current branch: ${branch}`);
      
      const status = execSync('git status --porcelain', { encoding: 'utf-8' });
      const hasUncommitted = status.length > 0;
      
      if (hasUncommitted) {
        const lines = status.trim().split('\n');
        console.log(`   Uncommitted changes: ${lines.length} file(s)`);
        this.addWarning(`You have ${lines.length} uncommitted change(s)`);
      } else {
        console.log('   Working directory is clean');
      }
      
      this.addCheck('Working directory status checked', true, 1);
      
    } catch (error) {
      this.addWarning(`Failed to check git status: ${error.message}`);
    }
  }

  // Check documentation quality
  checkDocumentation() {
    console.log('\n🔍 Checking Documentation...');
    
    try {
      const readme = fs.readFileSync('README.md', 'utf-8');
      
      const hasOverview = readme.toLowerCase().includes('overview');
      const hasQuickStart = readme.toLowerCase().includes('quick start');
      const hasExamples = readme.toLowerCase().includes('example');
      const hasConfiguration = readme.toLowerCase().includes('configuration');
      
      this.addCheck('README has overview section', hasOverview, 1);
      this.addCheck('README has quick start', hasQuickStart, 2);
      this.addCheck('README has examples', hasExamples, 2);
      this.addCheck('README has configuration docs', hasConfiguration, 1);
      
      const wordCount = readme.split(/\s+/).length;
      const isComprehensive = wordCount > 500;
      this.addCheck('README is comprehensive', isComprehensive, 1, `${wordCount} words`);
      
    } catch (error) {
      this.addWarning(`Failed to analyze README: ${error.message}`);
    }
  }

  // Check examples directory
  checkExamples() {
    console.log('\n🔍 Checking Examples...');
    
    const examplesDir = 'examples';
    const examplesExist = fs.existsSync(examplesDir);
    this.addCheck('Examples directory exists', examplesExist, 2);
    
    if (examplesExist) {
      const workflowsDir = path.join(examplesDir, 'workflows');
      const workflowsExist = fs.existsSync(workflowsDir);
      this.addCheck('Workflow examples exist', workflowsExist, 2);
      
      if (workflowsExist) {
        try {
          const files = fs.readdirSync(workflowsDir, { recursive: true });
          const yamlFiles = files.filter(f => f.toString().endsWith('.yml') || f.toString().endsWith('.yaml'));
          console.log(`   Found ${yamlFiles.length} workflow example(s)`);
          this.addCheck('Has workflow examples', yamlFiles.length > 0, 2);
        } catch (error) {
          this.addWarning(`Failed to read examples: ${error.message}`);
        }
      }
    } else {
      this.addRecommendation('Add examples directory with workflow examples');
    }
  }

  // Check dependencies
  checkDependencies() {
    console.log('\n🔍 Checking Dependencies...');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      
      const hasNodeModules = fs.existsSync('node_modules');
      this.addCheck('node_modules installed', hasNodeModules, 1);
      
      if (!hasNodeModules) {
        this.addRecommendation('Run "npm install" to install dependencies');
      }
      
      const hasLockFile = fs.existsSync('package-lock.json');
      this.addCheck('package-lock.json exists', hasLockFile, 1);
      
      // Check for scripts
      const hasScripts = packageJson.scripts && Object.keys(packageJson.scripts).length > 0;
      this.addCheck('package.json has scripts', hasScripts, 1);
      
    } catch (error) {
      this.addWarning(`Failed to check dependencies: ${error.message}`);
    }
  }

  // Check security best practices
  checkSecurity() {
    console.log('\n🔍 Checking Security Best Practices...');
    
    try {
      const gitignore = fs.readFileSync('.gitignore', 'utf-8');
      
      const securityPatterns = [
        { pattern: '.env', name: 'Environment files', points: 2 },
        { pattern: 'node_modules', name: 'Node modules', points: 1 },
        { pattern: '.gemini/', name: 'Gemini CLI settings', points: 1 },
        { pattern: 'gha-creds-', name: 'GitHub App credentials', points: 2 }
      ];
      
      securityPatterns.forEach(({ pattern, name, points }) => {
        const ignored = gitignore.includes(pattern);
        this.addCheck(`${name} ignored`, ignored, points);
      });
      
    } catch (error) {
      this.addWarning(`Failed to check security: ${error.message}`);
    }
  }

  // Generate the report
  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 WORKSPACE EVALUATION REPORT');
    console.log('='.repeat(70));
    
    const percentage = Math.round((this.results.score / this.results.maxScore) * 100);
    const grade = this.getGrade(percentage);
    
    console.log(`\n🎯 Overall Score: ${this.results.score}/${this.results.maxScore} (${percentage}%)`);
    console.log(`📈 Grade: ${grade}`);
    
    // Show passed and failed checks
    const passed = this.results.checks.filter(c => c.passed);
    const failed = this.results.checks.filter(c => !c.passed);
    
    console.log(`\n✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    // Show failed checks
    if (failed.length > 0) {
      console.log('\n❌ Failed Checks:');
      failed.forEach(check => {
        console.log(`   • ${check.name} ${check.details ? `(${check.details})` : ''}`);
      });
    }
    
    // Show warnings
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }
    
    // Show recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.results.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    // Summary message
    console.log('\n' + '='.repeat(70));
    if (percentage >= 90) {
      console.log('🎉 Excellent! Your workspace is in great shape!');
    } else if (percentage >= 75) {
      console.log('👍 Good job! Just a few minor improvements needed.');
    } else if (percentage >= 60) {
      console.log('⚠️  Your workspace needs some attention.');
    } else {
      console.log('🔧 Significant improvements recommended.');
    }
    console.log('='.repeat(70) + '\n');
    
    // Save results to file
    this.saveResults();
  }

  // Get grade based on percentage
  getGrade(percentage) {
    if (percentage >= 90) return 'A (Excellent)';
    if (percentage >= 80) return 'B (Good)';
    if (percentage >= 70) return 'C (Fair)';
    if (percentage >= 60) return 'D (Needs Improvement)';
    return 'F (Poor)';
  }

  // Save results to JSON file
  saveResults() {
    const outputPath = path.join(process.cwd(), 'evaluation-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
    console.log(`📝 Detailed results saved to: ${outputPath}\n`);
  }

  // Run all evaluations
  async run() {
    console.log('🚀 Starting Workspace Evaluation...');
    console.log(`📁 Working Directory: ${process.cwd()}\n`);
    
    this.checkRequiredFiles();
    this.checkEnvironment();
    this.checkActionYml();
    this.checkGitStatus();
    this.checkDocumentation();
    this.checkExamples();
    this.checkDependencies();
    this.checkSecurity();
    
    this.generateReport();
    
    // Return exit code based on score
    const percentage = (this.results.score / this.results.maxScore) * 100;
    return percentage >= 60 ? 0 : 1;
  }
}

// Run the evaluator
if (require.main === module) {
  const evaluator = new WorkspaceEvaluator();
  evaluator.run()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('❌ Evaluation failed:', error);
      process.exit(1);
    });
}

module.exports = WorkspaceEvaluator;
