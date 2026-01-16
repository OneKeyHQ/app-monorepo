const { execSync } = require('child_process');
const { exit } = require('process');

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

console.log(`[${getTimestamp()}] Oxlint check started...`);

const getDuration = () => ((Date.now() - startTime) / 1000).toFixed(2);
const failToExit = (_message) => {
  console.log(`[${getTimestamp()}] Oxlint check failed. (${getDuration()}s)`);
  exit(1);
};

// result example:
// Found 33 warnings and 0 errors.
// Finished in 1.0s on 4913 files with 133 rules using 14 threads.
try {
  const result = execSync('npx oxlint --tsconfig ./tsconfig.json . --fix', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  console.log(result);
} catch (error) {
  if (error.stdout) {
    console.log(error.stdout.toString('utf-8'));
  }
  if (error.stderr) {
    console.error(error.stderr.toString('utf-8'));
  }
  failToExit();
}

console.log(`[${getTimestamp()}] Oxlint check completed. (${getDuration()}s)`);
exit(0);
