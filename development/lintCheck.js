const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_WARNINGS_COUNT = 13;

function handleWarnings(result) {
  const warningsCount = result.match(/, (\d+) warnings\)/)?.[1];
  console.log(`Warnings Counts: ${warningsCount}`);
  if (Number(warningsCount) > MAX_WARNINGS_COUNT) {
    console.log(
      `Please do not add more ESLint warnings than ${MAX_WARNINGS_COUNT}`,
    );
    console.log(
      'Hope you can fix the ESLint warings introduced after this merge.',
    );
    exit(1);
  }
}

try {
  const result = execSync(
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)"'`,
  ).toString('utf-8');
  console.log(result);
  handleWarnings(result);
} catch (error) {
  console.log(error.stdout.toString('utf-8'));
  exit(1);
}

exit(0);
