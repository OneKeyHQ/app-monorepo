const { execSync } = require('child_process');
const { exit } = require('process');

const ERROR_LINES = 100;

try {
  execSync(
    `sh -c 'npx tsc --noEmit --tsBuildInfoFile \"$(yarn config get cacheFolder)\"/.app-mono-ts-cache'`,
  );
} catch (error) {
  const result = error.stdout.toString('utf-8');
  console.log(result);
  if (result.includes('packages/components')) {
    exit(1);
  }

  const lines = result.split('\n').length;
  if (lines > ERROR_LINES) {
    console.log(`Please do not add more errors than ${ERROR_LINES}`);
    console.log('Hope you can fix the ts errors introduced after this merge.');
    exit(1);
  }
}

exit(0);
