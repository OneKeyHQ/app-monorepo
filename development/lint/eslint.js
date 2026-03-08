const { execSync } = require('child_process');
const { exit } = require('process');
const os = require('os');

const getTimestamp = () => new Date().toLocaleTimeString();

// Detect CI environment - most CI platforms set CI=true
const isCI = !!process.env.CI;

console.log(`[${getTimestamp()}] Lint check started...`);

// ============================================
// Run Oxlint first (fast)
// ============================================
console.log(`[${getTimestamp()}] Oxlint check started...`);
const oxlintStartTime = Date.now();

try {
  const cpus =
    process.platform === 'darwin'
      ? Math.min(os.cpus().length, 4)
      : os.cpus().length;
  const fixFlag = isCI ? '' : ' --fix';
  console.log(
    `Using ${cpus} threads for oxlint...${isCI ? ' (CI mode, no --fix)' : ''}`,
  );
  const oxlintResult = execSync(
    `npx oxlint --tsconfig ./tsconfig.json --type-aware --threads=${cpus} .${fixFlag}`,
    { encoding: 'utf-8', stdio: 'pipe' },
  );

  // Parse oxlint output for warnings/errors
  // Example output: "Found 33 warnings and 0 errors."
  const warningMatch = oxlintResult.match(/Found (\d+) warning/);
  const errorMatch = oxlintResult.match(/(\d+) error/);
  const warnings = warningMatch ? Number(warningMatch[1]) : 0;
  const errors = errorMatch ? Number(errorMatch[1]) : 0;

  const oxlintDuration = ((Date.now() - oxlintStartTime) / 1000).toFixed(2);

  if (errors > 0 || warnings > 0) {
    console.log(oxlintResult);
    console.log(
      `[${getTimestamp()}] Oxlint check failed with ${errors} error(s) and ${warnings} warning(s). (${oxlintDuration}s)`,
    );
    exit(1);
  }

  console.log(`[${getTimestamp()}] Oxlint check passed. (${oxlintDuration}s)`);
} catch (error) {
  const oxlintDuration = ((Date.now() - oxlintStartTime) / 1000).toFixed(2);
  if (error.stdout) {
    console.log(error.stdout.toString('utf-8'));
  }
  if (error.stderr) {
    console.error(error.stderr.toString('utf-8'));
  }
  console.log(`[${getTimestamp()}] Oxlint check failed. (${oxlintDuration}s)`);
  exit(1);
}
