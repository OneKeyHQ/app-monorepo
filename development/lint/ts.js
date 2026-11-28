/* cspell:words GOMEMLIMIT GOGC tsgo */
const { execFileSync } = require('child_process');
const path = require('path');
const { exit } = require('process');

const { parse } = require('@aivenio/tsc-output-parser');

const {
  buildTscInvocation,
  getYarnCacheFolder,
} = require('../scripts/tsc-check');

const getTimestamp = () => new Date().toLocaleTimeString();
const startTime = Date.now();

// CI runs tsc in its own job, so the lint checks job sets this to run the rest
// of `yarn lint` without a second full type check.
if (process.env.ONEKEY_LINT_SKIP_TSC === 'true') {
  console.log(
    `[${getTimestamp()}] TypeScript check skipped (ONEKEY_LINT_SKIP_TSC=true).`,
  );
  exit(0);
}

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

const rootDir = path.join(__dirname, '../..');
const tsConfigPath = path.join(rootDir, 'tsconfig.json');
try {
  const cacheFolder = getYarnCacheFolder(rootDir);
  console.log(`[${getTimestamp()}] Using tsconfig: ${tsConfigPath}`);
  console.log(`[${getTimestamp()}] Using cache folder: ${cacheFolder}`);
  // Leave enough Go heap headroom on 16 GB CI runners while sharing the
  // checker count and GOGC defaults with local tsc:staged / tsc:only runs.
  const { command, args, env } = buildTscInvocation({
    rootDir,
    cacheFolder,
    pretty: false,
    defaultGoMemLimit: '11GiB',
    env: process.env,
  });
  const result = execFileSync(command, args, { env }).toString('utf-8');
  console.log(result);
} catch (error) {
  const stdout = error.stdout?.toString('utf-8') ?? '';
  const stderr = error.stderr?.toString('utf-8') ?? '';
  const compilerOutput = [stdout, stderr].filter(Boolean).join('\n');
  if (compilerOutput) {
    handleProblems(compilerOutput);
    console.error(compilerOutput);
  } else {
    console.error(error.message);
  }
  failToExit();
}

console.log(
  `[${getTimestamp()}] TypeScript check completed. (${getDuration()}s)`,
);
exit(0);
