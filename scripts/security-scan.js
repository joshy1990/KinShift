#!/usr/bin/env node
/**
 * KinShift Security Scanner
 * 
 * Scans the codebase for common security issues:
 * 1. Hardcoded secrets (API keys, passwords, tokens)
 * 2. Insecure URLs (http:// instead of https://)
 * 3. Dangerous eval/Function usage
 * 4. Console.log in production code (potential info leak)
 * 5. Overly-permissive Firestore rules
 * 
 * Run: node scripts/security-scan.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Config ─────────────────────────────────────────────────────────────────
const SCAN_DIRS = ['src', 'scripts'];
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORE_PATTERNS = [
  'node_modules', '.expo', 'android/build', 'ios/build',
  '__mocks__', 'tests', 'jest.', '.test.', '.spec.',
  'security-scan.js', // Don't scan ourselves
];

// ── Secret patterns ────────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  { name: 'AWS Key', regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
  { name: 'Generic Secret', regex: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Generic API Key (long hex)', regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/gi },
  { name: 'Bearer Token', regex: /Bearer\s+[A-Za-z0-9_\-.]{20,}/g },
];

// ── Insecure patterns ─────────────────────────────────────────────────────
const INSECURE_PATTERNS = [
  { name: 'HTTP URL (non-localhost)', regex: /http:\/\/(?!localhost|127\.0\.0\.1|10\.|192\.168\.|0\.0\.0\.0)[^\s'"]+/g, severity: 'warn' },
  { name: 'eval() usage', regex: /\beval\s*\(/g, severity: 'error' },
  { name: 'new Function()', regex: /new\s+Function\s*\(/g, severity: 'error' },
  { name: 'dangerouslySetInnerHTML', regex: /dangerouslySetInnerHTML/g, severity: 'warn' },
  { name: 'innerHTML assignment', regex: /\.innerHTML\s*=/g, severity: 'warn' },
  { name: 'document.write', regex: /document\.write\s*\(/g, severity: 'warn' },
];

// ── Results tracking ──────────────────────────────────────────────────────
const findings = [];
let filesScanned = 0;

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(p => filePath.includes(p));
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (shouldIgnore(full)) continue;
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relative = path.relative(ROOT, filePath);

  // Check for secrets
  for (const pattern of SECRET_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].match(pattern.regex);
      if (matches) {
        // Skip if in a comment explaining something
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') && !trimmed.includes('=')) continue;
        
        findings.push({
          severity: 'critical',
          type: 'Secret',
          name: pattern.name,
          file: relative,
          line: i + 1,
          snippet: lines[i].trim().substring(0, 120),
        });
      }
    }
  }

  // Check for insecure patterns
  for (const pattern of INSECURE_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].match(pattern.regex);
      if (matches) {
        findings.push({
          severity: pattern.severity,
          type: 'Insecure',
          name: pattern.name,
          file: relative,
          line: i + 1,
          snippet: lines[i].trim().substring(0, 120),
        });
      }
    }
  }

  filesScanned++;
}

function scanFirestoreRules() {
  const rulesPath = path.join(ROOT, 'firestore.rules');
  if (!fs.existsSync(rulesPath)) return;

  const content = fs.readFileSync(rulesPath, 'utf-8');
  const lines = content.split('\n');

  // Detect custom auth helper functions (isAuthenticated, isOwner, isHouseholdMember, etc.)
  // These wrap request.auth checks, so rules using them are NOT unprotected.
  const authHelpers = new Set();
  for (const line of lines) {
    const funcMatch = line.match(/function\s+(\w+)\s*\(/);
    if (funcMatch) {
      // Scan the next few lines to see if this function references request.auth
      const funcStart = lines.indexOf(line);
      const funcBody = lines.slice(funcStart, funcStart + 5).join(' ');
      if (/request\.auth/.test(funcBody)) {
        authHelpers.add(funcMatch[1]);
      }
    }
  }

  // Check for overly-permissive rules
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // allow read, write: if true
    if (/allow\s+(read|write|create|update|delete).*:\s*if\s+true/.test(line)) {
      findings.push({
        severity: 'critical',
        type: 'Firestore Rules',
        name: 'Unrestricted access',
        file: 'firestore.rules',
        line: i + 1,
        snippet: line,
      });
    }

    // Wildcard collection access without auth check
    if (/allow\s+(read|write)/.test(line) && !/request\.auth/.test(line) && !line.startsWith('//')) {
      // Check if line uses a known auth helper function
      const usesAuthHelper = [...authHelpers].some(fn => line.includes(fn + '('));
      if (usesAuthHelper) continue; // Safe — uses an auth-wrapping helper

      // Check next few lines for auth check
      const context = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
      if (!/request\.auth/.test(context) && !/if\s+false/.test(context)) {
        // Also check context for auth helpers
        const contextUsesHelper = [...authHelpers].some(fn => context.includes(fn + '('));
        if (contextUsesHelper) continue;

        findings.push({
          severity: 'warn',
          type: 'Firestore Rules',
          name: 'Rule without auth check',
          file: 'firestore.rules',
          line: i + 1,
          snippet: line,
        });
      }
    }
  }
}

function checkNpmAudit() {
  try {
    const { execSync } = require('child_process');
    const isWin = process.platform === 'win32';
    const result = execSync(
      isWin ? 'npm audit --json 2>nul' : 'npm audit --json 2>/dev/null || true',
      {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    
    try {
      const audit = JSON.parse(result);
      if (audit.metadata && audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities;
        const total = (vulns.critical || 0) + (vulns.high || 0) + (vulns.moderate || 0);
        if (total > 0) {
          findings.push({
            severity: vulns.critical ? 'critical' : vulns.high ? 'error' : 'warn',
            type: 'Dependencies',
            name: `npm audit: ${vulns.critical || 0} critical, ${vulns.high || 0} high, ${vulns.moderate || 0} moderate`,
            file: 'package.json',
            line: 1,
            snippet: `Run 'npm audit' for details`,
          });
        }
      }
    } catch {
      // JSON parse failed, skip
    }
  } catch {
    // npm audit not available or timed out
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('🔒 KinShift Security Scanner\n');
console.log('Scanning source files...');

for (const dir of SCAN_DIRS) {
  const files = walkDir(path.join(ROOT, dir));
  files.forEach(scanFile);
}

// Also scan root-level config files
const rootConfigs = ['app.config.js', 'babel.config.js', 'metro.config.js'];
for (const cfg of rootConfigs) {
  const cfgPath = path.join(ROOT, cfg);
  if (fs.existsSync(cfgPath)) scanFile(cfgPath);
}

console.log(`Scanned ${filesScanned} files.`);

// Scan Firestore rules
console.log('Scanning Firestore rules...');
scanFirestoreRules();

// Run npm audit
console.log('Running npm audit...');
checkNpmAudit();

// ── Report ─────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));

if (findings.length === 0) {
  console.log('✅ No security issues found!');
} else {
  const critical = findings.filter(f => f.severity === 'critical');
  const errors = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warn');

  console.log(`Found ${findings.length} issue(s): ${critical.length} critical, ${errors.length} error, ${warnings.length} warning\n`);

  for (const f of [...critical, ...errors, ...warnings]) {
    const icon = f.severity === 'critical' ? '🔴' : f.severity === 'error' ? '🟠' : '🟡';
    console.log(`${icon} [${f.severity.toUpperCase()}] ${f.name}`);
    console.log(`   ${f.file}:${f.line}`);
    console.log(`   ${f.snippet}\n`);
  }
}

console.log('='.repeat(70));

// Exit with non-zero if critical issues found
const criticalCount = findings.filter(f => f.severity === 'critical').length;
if (criticalCount > 0) {
  console.log(`\n❌ ${criticalCount} critical issue(s) must be resolved before release.`);
  process.exit(1);
}

console.log('\n✅ Security scan complete.');
process.exit(0);
