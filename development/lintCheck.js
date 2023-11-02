const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_ERROR_COUNT = 90;
const MAX_WARNINGS_COUNT = 730;

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

try {
  const result = execSync(
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)"'`,
  ).toString('utf-8');
  console.log(result);
  handleWarnings(result);
} catch (error) {
  const result = error.stdout.toString('utf-8');
  console.log(result);

  const errorCount = Number(result.match(/(\d+) errors/)?.[1]);
  const isErrorExit = errorCount > MAX_ERROR_COUNT;
  if (isErrorExit) {
    console.log(`Error Counts: ${errorCount}`);
    console.log(`Please do not add more ESLint errors than ${MAX_ERROR_COUNT}`);
    console.log(
      'Hope you can fix the ESLint erros introduced after this merge.\n',
    );
  }

  handleWarnings(result);

  if (isErrorExit) {
    exit(1);
  }
}

exit(0);
