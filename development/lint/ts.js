const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_PROBLEM_COUNT = 375;

function handleProblems(result) {
  console.log(result);
  const errorCount = result.match(/Found (\d+) errors/)?.[1];
  if (Number(errorCount) > MAX_PROBLEM_COUNT) {
    console.log(
      `The maximum allowed error count is ${MAX_PROBLEM_COUNT}, the current error count is ${errorCount}`,
    );
    console.log('Hope you can fix the TypeScript Errors before this merge.');
    exit(1);
  }
}

try {
  const result = execSync(
    `sh -c 'npx tsc --noEmit --tsBuildInfoFile \"$(yarn config get cacheFolder)\"/.app-mono-ts-cache  --pretty'`,
  ).toString('utf-8');
} catch (error) {
  const errorMsg = error.stdout.toString('utf-8');
  handleProblems(errorMsg);
}

exit(0);
