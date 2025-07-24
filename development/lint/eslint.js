const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_PROBLEM_COUNT = 0;

function handleProblems(result) {
  console.log(result);
  const problemsCount = result.match(/(\d+) problem/)?.[1];
  if (Number(problemsCount) > MAX_PROBLEM_COUNT) {
    console.log('Hope you can fix the ESLint problems before this merge.');
    if (process.env.NODE_ENV === 'production') {
      exit(1);
    }
  }
}

try {
  console.log('Running ESLint in all workspaces in parallel...');

  const result = execSync('yarn workspaces foreach -p -A run lint', {
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
    stdio: 'pipe',
  }).toString('utf-8');

  handleProblems(result);
} catch (error) {
  if (error.stdout) {
    console.log(error.stdout.toString('utf-8'));
  }
  if (error.stderr) {
    console.error(error.stderr.toString('utf-8'));
  }
  exit(1);
}

exit(0);
