const { execSync } = require('child_process');
const { exit } = require('process');

function handleProblems(result) {
  // Extract error and warning counts from output like "✖ X problems (Y errors, Z warnings)"
  const errorMatch = result.match(/(\d+) error/);
  const warningMatch = result.match(/(\d+) warning/);
  const errorCount = errorMatch ? Number(errorMatch[1]) : 0;
  const warningCount = warningMatch ? Number(warningMatch[1]) : 0;

  // Only output if there are errors
  if (errorCount > 0) {
    // Filter output to show only error lines
    const lines = result.split('\n');
    const filteredLines = lines.filter((line) => {
      // Keep file paths, error lines, and summary lines
      // Skip warning lines (lines containing "warning" but not "warnings" in summary)
      if (line.includes('warning') && !line.match(/\d+ warning/)) {
        return false;
      }
      return true;
    });

    console.log(filteredLines.join('\n'));

    // Show warning count if there are warnings
    if (warningCount > 0) {
      console.log(`\nℹ ${warningCount} warning(s) (not shown)`);
    }

    console.log('\nHope you can fix the ESLint problems before this merge.');
    if (process.env.NODE_ENV === 'production') {
      exit(1);
    }
  } else if (warningCount > 0) {
    // If only warnings, just show the count
    console.log(`ℹ ${warningCount} warning(s) found (no errors)`);
  }
}

try {
  const result = execSync(
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)"'`,
  ).toString('utf-8');
  handleProblems(result);
} catch (error) {
  console.log(error.stdout.toString('utf-8'));
  exit(1);
}

exit(0);
