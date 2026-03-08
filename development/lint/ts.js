const { execSync, execFileSync } = require('child_process');
const { exit } = require('process');
const { parse } = require('@aivenio/tsc-output-parser');
const path = require('path');

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

console.log(`[${getTimestamp()}] TypeScript check started...`);

const getDuration = () => ((Date.now() - startTime) / 1000).toFixed(2);
const failToExit = () => {
  console.log(
    `[${getTimestamp()}] TypeScript check failed. (${getDuration()}s)`,
  );
  exit(1);
};

function handleProblems(result) {
  let basicErrorCount = 0;
  const basicErrors = [];

  for (const problem of parse(result)) {
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
    failToExit();
  }
}

const tsConfigPath = path.join(__dirname, '../../tsconfig.json');
try {
  const cacheFolder = execSync('yarn config get cacheFolder')
    .toString('utf-8')
    .trim();
  console.log(`[${getTimestamp()}] Using tsconfig: ${tsConfigPath}`);
  console.log(`[${getTimestamp()}] Using cache folder: ${cacheFolder}`);
  const tsBuildInfoPath = path.join(cacheFolder, '.app-mono-ts-cache');
  const result = execFileSync('npx', [
    'tsgo',
    '-p',
    tsConfigPath,
    '--noEmit',
    '--tsBuildInfoFile',
    tsBuildInfoPath,
  ]).toString('utf-8');
  console.log(result);
} catch (error) {
  const errorMsg = error.stdout.toString('utf-8');
  handleProblems(errorMsg);
}

console.log(
  `[${getTimestamp()}] TypeScript check completed. (${getDuration()}s)`,
);
exit(0);
