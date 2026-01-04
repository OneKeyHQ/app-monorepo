const { execSync } = require('child_process');
const { exit } = require('process');

// Warning limit configuration
const INITIAL_MAX_WARNINGS = 690;
const WEEKLY_REDUCTION = 30;
const START_YEAR = 2026;

function getMaxWarnings() {
  const now = new Date();
  const startOfYear = new Date(START_YEAR, 0, 1);

  if (now < startOfYear) {
    return INITIAL_MAX_WARNINGS;
  }

  // Calculate weeks since start of 2026
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((now - startOfYear) / msPerWeek);

  const maxWarnings = INITIAL_MAX_WARNINGS - weeksSinceStart * WEEKLY_REDUCTION;
  return Math.max(0, maxWarnings); // Never go below 0
}

// lint results example:
// app-monorepo/apps/desktop/app/libs/react-native-mmkv-mock.ts
//    9:15  warning  'options' is defined but never used. Allowed unused args must match /^_/u  @typescript-eslint/no-unused-vars
//   43:3   warning  You have a misspelled word: recrypt on Identifier                          spellcheck/spell-checker

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
    // Randomly select files until we cover the overflow
    const shuffled = [...warningOnlyGroups].sort(() => Math.random() - 0.5);
    let accumulatedWarnings = 0;

    for (const item of shuffled) {
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
          `⚠️  WARNING LIMIT EXCEEDED by ${warningOverflow}! Showing ${selectedWarningGroups.length} random file(s) with warnings.`,
        );
        console.log(
          `Please fix these warnings! Limit reduces by ${WEEKLY_REDUCTION} every week.`,
        );
      }
    }

    if (errorCount > 0) {
      console.log('\nHope you can fix the ESLint problems before this merge.');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      (errorCount > 0 || warningOverflow > 0)
    ) {
      exit(1);
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
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)"'`,
  ).toString('utf-8');
  handleProblems(result);
} catch (error) {
  handleProblems(error.stdout.toString('utf-8'));
  exit(1);
}

exit(0);
