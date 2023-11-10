const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_ERROR_COUNT = 58;

try {
  execSync(
    `sh -c 'npx tsc --noEmit --tsBuildInfoFile \"$(yarn config get cacheFolder)\"/.app-mono-ts-cache  --pretty'`,
  );
} catch (error) {
  const result = error.stdout.toString('utf-8');
  console.log(result);
  if (result.includes('packages/components')) {
    console.error('\n\n\n');
    console.error('Please do not add errors in packages/components');
    exit(1);
  }

  const errorCount = result.match(/Found (\d+) errors in/)?.[1];
  if (errorCount > MAX_ERROR_COUNT) {
    console.error('\n\n\n');
    console.error(`Error count: ${errorCount}`);
    console.error(`Please do not add more errors than ${MAX_ERROR_COUNT}`);
    console.error(
      'Hope you can fix the ts errors introduced after this merge.',
    );
    exit(1);
  }
}

exit(0);
