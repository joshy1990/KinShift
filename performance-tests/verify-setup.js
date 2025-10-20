#!/usr/bin/env node
/**
 * Performance Testing Setup Verification
 * 
 * Checks that all required files and dependencies are in place
 * Run with: node verify-setup.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bright: '\x1b[1m',
};

class SetupVerifier {
  constructor() {
    this.checks = [];
    this.testDir = path.join(__dirname, 'performance-tests');
  }

  log(message, type = 'info') {
    const prefix = {
      success: `${colors.green}✓${colors.reset}`,
      error: `${colors.red}✗${colors.reset}`,
      warning: `${colors.yellow}⚠${colors.reset}`,
      info: `${colors.blue}ℹ${colors.reset}`,
    }[type] || '';
    
    console.log(`${prefix} ${message}`);
  }

  logHeader(title) {
    console.log(`\n${colors.bright}${colors.cyan}${title}${colors.reset}`);
    console.log(colors.cyan + '─'.repeat(50) + colors.reset + '\n');
  }

  /**
   * Check if file exists
   */
  checkFile(filePath, description) {
    const fullPath = path.join(__dirname, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      const stats = fs.statSync(fullPath);
      const size = this.formatBytes(stats.size);
      this.log(`${description} (${size})`, 'success');
      this.checks.push({ file: filePath, passed: true });
    } else {
      this.log(`${description} - NOT FOUND at ${filePath}`, 'error');
      this.checks.push({ file: filePath, passed: false });
    }
    
    return exists;
  }

  /**
   * Check Node.js modules
   */
  checkModule(moduleName) {
    try {
      require.resolve(moduleName);
      this.log(`Module '${moduleName}' is installed`, 'success');
      this.checks.push({ module: moduleName, passed: true });
      return true;
    } catch {
      this.log(`Module '${moduleName}' not found - run: npm install ${moduleName}`, 'warning');
      this.checks.push({ module: moduleName, passed: false });
      return false;
    }
  }

  /**
   * Check Node.js version
   */
  checkNodeVersion() {
    const version = process.version.slice(1); // Remove 'v' prefix
    const major = parseInt(version.split('.')[0]);
    
    if (major >= 14) {
      this.log(`Node.js version: ${version} (required: >= 14)`, 'success');
      this.checks.push({ check: 'Node version', passed: true });
      return true;
    } else {
      this.log(`Node.js version: ${version} (required: >= 14) - Please upgrade`, 'error');
      this.checks.push({ check: 'Node version', passed: false });
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  checkDirectory(dirPath, description) {
    const fullPath = path.join(__dirname, dirPath);
    const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    
    if (exists) {
      this.log(`${description}`, 'success');
      this.checks.push({ dir: dirPath, passed: true });
    } else {
      this.log(`${description} - NOT FOUND at ${dirPath}`, 'error');
      this.checks.push({ dir: dirPath, passed: false });
    }
    
    return exists;
  }

  /**
   * Check npm scripts
   */
  checkNpmScripts() {
    try {
      const packageJson = require(path.join(__dirname, 'package.json'));
      const scripts = packageJson.scripts || {};
      
      const requiredScripts = [
        'test:performance',
        'test:load',
        'test:profiler',
        'test:firebase',
      ];
      
      let allFound = true;
      requiredScripts.forEach(script => {
        if (scripts[script]) {
          this.log(`npm script '${script}' found`, 'success');
          this.checks.push({ script, passed: true });
        } else {
          this.log(`npm script '${script}' not found in package.json`, 'warning');
          this.checks.push({ script, passed: false });
          allFound = false;
        }
      });
      
      return allFound;
    } catch {
      this.log('Could not read package.json', 'error');
      return false;
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  /**
   * Run all verifications
   */
  async verify() {
    console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}║  Performance Testing Setup Verification       ║${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}\n`);

    // 1. Check Node.js
    this.logHeader('1️⃣  Environment Setup');
    this.checkNodeVersion();

    // 2. Check directories
    this.logHeader('2️⃣  Directory Structure');
    this.checkDirectory('performance-tests', 'performance-tests directory');
    this.checkDirectory('src', 'src directory');

    // 3. Check test files
    this.logHeader('3️⃣  Test Files');
    this.checkFile('performance-tests/load-test.js', 'Load testing script');
    this.checkFile('performance-tests/react-native-profiler.js', 'React Native profiler');
    this.checkFile('performance-tests/firebase-load-test.sh', 'Firebase load test script');
    this.checkFile('performance-tests/test-runner.js', 'Master test runner');
    this.checkFile('performance-tests/README.md', 'Performance test documentation');

    // 4. Check documentation
    this.logHeader('4️⃣  Documentation');
    this.checkFile('PERFORMANCE_TESTING_START_HERE.md', 'Quick start guide');

    // 5. Check npm scripts
    this.logHeader('5️⃣  NPM Configuration');
    this.checkNpmScripts();

    // 6. Print results
    this.printResults();
  }

  /**
   * Print verification results
   */
  printResults() {
    const passed = this.checks.filter(c => c.passed).length;
    const total = this.checks.length;
    const passRate = Math.round((passed / total) * 100);

    this.logHeader('📊 Verification Results');

    console.log(`Total Checks: ${total}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${total - passed}${colors.reset}`);
    console.log(`Pass Rate: ${passRate}%\n`);

    if (passed === total) {
      console.log(`${colors.green}${colors.bright}✓ All checks passed! Setup is complete.${colors.reset}`);
      console.log(`\n${colors.blue}Next steps:${colors.reset}`);
      console.log(`  1. Run: ${colors.cyan}npm run test:performance${colors.reset}`);
      console.log(`  2. Review results and recommendations`);
      console.log(`  3. Implement optimizations if needed`);
      console.log(`  4. Re-run tests to verify improvements\n`);
    } else {
      console.log(`${colors.yellow}${colors.bright}⚠ Some checks failed. See details above.${colors.reset}\n`);
      console.log(`${colors.blue}To fix:${colors.reset}`);
      console.log(`  1. Install missing dependencies: ${colors.cyan}npm install${colors.reset}`);
      console.log(`  2. Ensure all test files are present`);
      console.log(`  3. Update package.json with npm scripts`);
      console.log(`  4. Re-run verification: ${colors.cyan}node verify-setup.js${colors.reset}\n`);
    }
  }
}

// Run verification
const verifier = new SetupVerifier();
verifier.verify().catch((error) => {
  console.error('Verification error:', error);
  process.exit(1);
});
