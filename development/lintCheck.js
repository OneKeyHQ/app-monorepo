const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_WARNINGS_COUNT = 10;

function handleWarnings(result) {
  const warningsCount = result.match(/, (\d+) warnings\)/)?.[1];
  if (Number(warningsCount) > MAX_WARNINGS_COUNT) {
    console.log(`Warnings Counts: ${warningsCount}`);
    console.log(
      `Please do not add more ESLint warnings than ${MAX_WARNINGS_COUNT}`,
    );
    console.log(
      'Hope you can fix the ESLint warings introduced after this merge.',
    );
    exit(1);
  }
}

const result = execSync(
  `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)"'`,
).toString('utf-8');
console.log(result);
handleWarnings(result);

exit(0);
