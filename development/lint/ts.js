const { execSync, execFileSync } = require('child_process');
const path = require('path');
const { exit } = require('process');

const { parse } = require('@aivenio/tsc-output-parser');

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
  const typescriptPackage = require.resolve('@typescript/native/package.json');
  const tscEntry = path.join(path.dirname(typescriptPackage), 'bin', 'tsc');
  const result = execFileSync(process.execPath, [
    tscEntry,
    '-p',
    tsConfigPath,
    '--noEmit',
    '--tsBuildInfoFile',
    tsBuildInfoPath,
  ]).toString('utf-8');
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
