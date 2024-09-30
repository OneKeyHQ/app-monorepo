const { execSync } = require('child_process');
const { exit } = require('process');
const { parse } = require('@aivenio/tsc-output-parser');

function handleProblems(result) {
  let basicErrorCount = 0;
  const basicErrors = [];

  for (const problem of parse(result)) {
    const message = problem.value.message.value;
    basicErrorCount += 1;
    basicErrors.push(problem);
  }
  if (basicErrorCount > 0) {
    console.error(
      basicErrors
        .map(
          (p) =>
            `${p.value.path.value}: line ${p.value.cursor.value.line} col ${p.value.cursor.value.col}, ${p.value.message.value}`,
        )
        .join('\n'),
    );
    exit(1);
  }
}

try {
  const result = execSync(
    `sh -c 'npx tsc --noEmit --tsBuildInfoFile \"$(yarn config get cacheFolder)\"/.app-mono-ts-cache'`,
  ).toString('utf-8');
  console.log(result);
} catch (error) {
  const errorMsg = error.stdout.toString('utf-8');
  handleProblems(errorMsg);
}

exit(0);
