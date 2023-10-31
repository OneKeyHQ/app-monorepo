const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_WARNINGS_COUNT = 180;

try {
  execSync(
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location \"$(yarn config get cacheFolder)\"'`,
  );
} catch (error) {
  const result = error.stdout.toString('utf-8');
  console.log(result);

  const errorCount = Number(result.match(/(\d+) errors/)?.[1]);
  if (errorCount > 0) {
    console.error(`${errorCount} errors must be resolved`);
    exit(1);
  }

  const WarningsCount = result.match(/, (\d+) warnings\)/)?.[1];
  if (Number(WarningsCount) > MAX_WARNINGS_COUNT) {
    console.log(`Warnings Counts: ${WarningsCount}`);
    console.log(
      `Please do not add more ESLint warnings than ${MAX_WARNINGS_COUNT}`,
    );
    console.log('Hope you can fix the ts warings introduced after this merge.');
    exit(1);
  }
}

exit(0);
