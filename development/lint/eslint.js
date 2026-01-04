const { execSync } = require('child_process');
const { exit } = require('process');

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

  // Only output if there are errors
  if (errorCount > 0) {
    // Group lines by file and filter files that contain errors
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

    // Filter: only keep file groups that contain errors
    const filteredGroups = fileGroups.filter((group) => {
      return group.some((line) => line.includes(' error '));
    });

    // Output filtered groups
    const output = filteredGroups.map((group) => group.join('\n')).join('\n\n');
    if (output) {
      console.log(output);
    }

    // Extract and show summary line
    const summaryLine = lines.find((line) => line.startsWith('✖'));
    if (summaryLine) {
      console.log(`\n${summaryLine}`);
    }

    // Show warning count
    if (warningCount > 0) {
      console.log(`ℹ ${warningCount} warning(s) in total`);
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
  handleProblems(error.stdout.toString('utf-8'));
  exit(1);
}

exit(0);
