const { execSync } = require('child_process');
const { exit } = require('process');

const MAX_PROBLEM_COUNT = 0;

function runEslintCommand(command, description) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Running ${description}...`);
      const result = execSync(command).toString('utf-8');
      resolve({ result, description });
    } catch (eslintError) {
      const stdout = eslintError.stdout?.toString('utf-8') || '';
      const stderr = eslintError.stderr?.toString('utf-8') || '';

      if (stderr) {
        console.log(`Error stderr: ${stderr}`);
        reject(new Error(`${description} failed: ${eslintError.message}`));
      } else {
        resolve({ result: stdout, description });
      }
    }
  });
}

async function runParallelEslint() {
  const startTime = Date.now();
  const cacheLocation = '"$(yarn config get cacheFolder)"';

  const sharedCommand = `sh -c 'npx eslint packages/shared --ext .ts,.tsx --fix --cache --cache-location ${cacheLocation}'`;
  const othersCommand = `sh -c 'npx eslint . --ext .ts,.tsx --fix --cache --cache-location ${cacheLocation} --ignore-pattern "packages/shared/**"'`;

  try {
    const results = await Promise.all([
      runEslintCommand(sharedCommand, 'ESLint for packages/shared'),
      runEslintCommand(othersCommand, 'ESLint for other packages'),
    ]);

    let totalProblems = 0;
    let combinedOutput = '';

    results.forEach(({ result, description }) => {
      console.log(`\n=== ${description} ===`);
      combinedOutput += `\n=== ${description} ===\n${result}`;

      const problemsCount = result.match(/(\d+) problem/)?.[1];
      if (problemsCount) {
        totalProblems += Number(problemsCount);
      }
    });

    if (totalProblems > MAX_PROBLEM_COUNT) {
      console.log(`\nTotal problems found: ${totalProblems}`);
      console.log('Hope you can fix the ESLint problems before this merge.');
      if (process.env.NODE_ENV === 'production') {
        exit(1);
      }
    }

    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(
      `\nESLint completed successfully for all packages in ${executionTime} seconds.`,
    );
  } catch (error) {
    console.log(`\n=== Error ===`);
    console.log(error.message);
    exit(1);
  }
}

runParallelEslint()
  .then(() => {
    exit(0);
  })
  .catch(() => {
    exit(1);
  });
