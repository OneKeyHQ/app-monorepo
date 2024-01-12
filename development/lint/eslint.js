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
  const result = execSync(
    `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location "$(yarn config get cacheFolder)"'`,
  ).toString('utf-8');
  handleProblems(result);
} catch (error) {
  console.log(error.stdout.toString('utf-8'));
  exit(1);
}

exit(0);
