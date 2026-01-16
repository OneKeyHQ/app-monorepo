const { execSync } = require('child_process');
const { exit } = require('process');

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

console.log(`[${getTimestamp()}] Lint check started...`);

// ============================================
// Run Oxlint first (fast)
// ============================================
console.log(`[${getTimestamp()}] Oxlint check started...`);
const oxlintStartTime = Date.now();

try {
  const oxlintResult = execSync(
    'npx oxlint --tsconfig ./tsconfig.json . --fix',
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

// ============================================
// Run ESLint (for rules not covered by oxlint)
// ============================================
console.log(`[${getTimestamp()}] ESLint check started...`);

const getDuration = () => ((Date.now() - startTime) / 1000).toFixed(2);
const failToExit = (_message) => {
  console.log(`[${getTimestamp()}] ESLint check failed. (${getDuration()}s)`);
  exit(1);
};

// Get files changed in the last N commits
function getRecentCommitFiles(commitCount = 10) {
  try {
    const result = execSync(
      `git log --name-only --pretty=format: -n ${commitCount}`,
      { encoding: 'utf-8' },
    );
    const files = result
      .split('\n')
      .filter(
        (line) =>
          line.trim() && (line.endsWith('.ts') || line.endsWith('.tsx')),
      )
      .map((file) => file.trim());
    // Return unique files
    return [...new Set(files)];
  } catch {
    return [];
  }
}

// Warning limit configuration
const INITIAL_MAX_WARNINGS = 0;

function getMaxWarnings() {
  return INITIAL_MAX_WARNINGS;
}

// lint results example:
// app-monorepo/apps/desktop/app/libs/react-native-mmkv-mock.ts
//    9:15  warning  'options' is defined but never used. Allowed unused args must match /^_/u  @typescript-eslint/no-unused-vars
//   43:3   warning  You have a misspelled word: recrypt on Identifier                          @cspell/spellchecker

// app-monorepo/apps/desktop/web-build/static/js-sdk/data/config.ts
//    6:36  error  Unsafe member access .version on an `any` value                                                         @typescript-eslint/no-unsafe-member-access
//    6:36  error  Unsafe return of an `any` typed value                                                                   @typescript-eslint/no-unsafe-return
//    7:58  error  Invalid type "any" of template literal expression                                                       @typescript-eslint/restrict-template-expressions
//   30:10  error  Unsafe member access .$$perfStart_apps_desktop_web_build_static_js_sdk_data_config_t on an `any` value  @typescript-eslint/no-unsafe-member-access
//   40:5   error  Unsafe member access .$$perfStart_apps_desktop_web_build_static_js_sdk_data_config_t on an `any` value  @typescript-eslint/no-unsafe-member-access

// app-monorepo/apps/ext/src/background/extUI.ts
//   17:11  warning  'p' is assigned a value but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
//   27:24  warning  'port' is defined but never used. Allowed unused args must match /^_/u        @typescript-eslint/no-unused-vars

function handleProblems(result) {
  // Extract error and warning counts from output like "✖ X problems (Y errors, Z warnings)"
  const errorMatch = result.match(/(\d+) error/);
  const warningMatch = result.match(/(\d+) warning/);
  const errorCount = errorMatch ? Number(errorMatch[1]) : 0;
  const warningCount = warningMatch ? Number(warningMatch[1]) : 0;

  // Group lines by file
  const lines = result.split('\n');
  const fileGroups = [];
  let currentGroup = [];

  for (const line of lines) {
    // File path line: not empty, doesn't start with space, and doesn't start with ✖
    if (line && !line.startsWith(' ') && !line.startsWith('✖')) {
      // Save previous group if exists
      if (currentGroup.length > 0) {
        fileGroups.push(currentGroup);
      }
      // Start new group with file path
      currentGroup = [line];
    } else if (line.trim() && !line.startsWith('✖')) {
      // Add problem line to current group (skip summary line)
      currentGroup.push(line);
    }
  }
  // Add last group
  if (currentGroup.length > 0) {
    fileGroups.push(currentGroup);
  }

  // Categorize file groups
  const errorGroups = [];
  const warningOnlyGroups = [];

  for (const group of fileGroups) {
    const hasError = group.some((line) => line.includes(' error '));
    if (hasError) {
      errorGroups.push(group);
    } else {
      // Count warnings in this group
      const warningLines = group.filter((line) => line.includes(' warning '));
      if (warningLines.length > 0) {
        warningOnlyGroups.push({ group, warningCount: warningLines.length });
      }
    }
  }

  // Check warning limit
  const maxWarnings = getMaxWarnings();
  const warningOverflow = warningCount - maxWarnings;

  // Determine which warning-only groups to display
  const selectedWarningGroups = [];
  if (warningOverflow > 0) {
    // Need to show some warning files to alert user
    // Prioritize files from recent commits, then randomly select others
    console.log(
      `Detected ${warningOverflow} warnings over the limit of ${maxWarnings}. Prioritizing recent files...`,
    );
    const recentFiles = getRecentCommitFiles(10);
    // Separate warning groups into recent and non-recent
    const recentWarningGroups = [];
    const otherWarningGroups = [];

    for (const item of warningOnlyGroups) {
      const filePath = item.group[0]; // First line is file path
      const isRecent = recentFiles.some((f) => filePath.includes(f));
      if (isRecent) {
        recentWarningGroups.push(item);
      } else {
        otherWarningGroups.push(item);
      }
    }

    // First add recent files, then randomly select from others if needed
    const shuffledRecent = [...recentWarningGroups].toSorted(
      () => Math.random() - 0.5,
    );
    const shuffledOther = [...otherWarningGroups].toSorted(
      () => Math.random() - 0.5,
    );
    const prioritized = [...shuffledRecent, ...shuffledOther];

    let accumulatedWarnings = 0;

    for (const item of prioritized) {
      selectedWarningGroups.push(item.group);
      accumulatedWarnings += item.warningCount;
      if (accumulatedWarnings >= warningOverflow) {
        break;
      }
    }
  }

  // Output results
  const hasOutput = errorCount > 0 || warningOverflow > 0;

  if (hasOutput) {
    // Output error groups
    if (errorGroups.length > 0) {
      const output = errorGroups.map((group) => group.join('\n')).join('\n\n');
      console.log(output);
    }

    // Output selected warning groups if any
    if (selectedWarningGroups.length > 0) {
      if (errorGroups.length > 0) {
        console.log(''); // Add spacing
      }
      const output = selectedWarningGroups
        .map((group) => group.join('\n'))
        .join('\n\n');
      console.log(output);
    }

    // Extract and show summary line
    const summaryLine = lines.find((line) => line.startsWith('✖'));
    if (summaryLine) {
      console.log(`\n${summaryLine}`);
    }

    // Show warning limit status
    if (warningCount > 0) {
      console.log(
        `ℹ ${warningCount} warning(s) in total (limit: ${maxWarnings})`,
      );

      if (warningOverflow > 0) {
        console.log(
          `⚠️  WARNING LIMIT EXCEEDED by ${warningOverflow}! Showing ${selectedWarningGroups.length} file(s) with warnings (prioritizing recent commits).`,
        );
        console.log(
          `Please fix these warnings! Limit is set to ${maxWarnings} to gradually reduce overall warnings.`,
        );
      }
    }

    if (errorCount > 0) {
      console.log('\nHope you can fix the ESLint problems before this merge.');
    }

    if (errorCount > 0 || warningOverflow > 0) {
      failToExit();
    }
  } else if (warningCount > 0) {
    // Warnings exist but within limit
    console.log(
      `ℹ ${warningCount} warning(s) found (limit: ${maxWarnings}, no errors)`,
    );
  }
}

try {
  const result = execSync(
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)/.eslintcache"'`,
  ).toString('utf-8');
  handleProblems(result);
} catch (error) {
  handleProblems(error.stdout.toString('utf-8'));
  failToExit();
}

console.log(`[${getTimestamp()}] ESLint check completed. (${getDuration()}s)`);
exit(0);
