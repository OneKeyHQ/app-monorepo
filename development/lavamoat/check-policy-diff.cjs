const fs = require('fs');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  let outputFile;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      outputFile = argv[index + 1];
      if (!outputFile || outputFile.startsWith('--')) {
        throw new Error('Missing output file after --output');
      }
      index += 1;
      continue;
    }

    if (arg.startsWith('--output=')) {
      outputFile = arg.slice('--output='.length);
      if (!outputFile) {
        throw new Error('Missing output file after --output=');
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { outputFile };
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function assertGitSuccess(result, command) {
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with status ${result.status}:\n${result.stderr}`,
    );
  }
}

function getTrackedDiff() {
  const result = runGit(['diff', '--binary', '--', 'lavamoat']);
  assertGitSuccess(result, 'git diff --binary -- lavamoat');
  return result.stdout;
}

function getUntrackedFiles() {
  const result = runGit([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    'lavamoat',
  ]);
  assertGitSuccess(result, 'git ls-files --others --exclude-standard -- lavamoat');
  return result.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function getNewFileDiff(file) {
  const result = runGit(['diff', '--no-index', '--binary', '/dev/null', file]);

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `git diff --no-index --binary /dev/null ${file} failed with status ${result.status}:\n${result.stderr}`,
    );
  }

  return result.stdout;
}

function joinPatches(patches) {
  return patches
    .filter(Boolean)
    .map((patch) => patch.trimEnd())
    .join('\n');
}

function main() {
  const { outputFile } = parseArgs(process.argv.slice(2));
  const patches = [
    getTrackedDiff(),
    ...getUntrackedFiles().map(getNewFileDiff),
  ];
  const diff = joinPatches(patches);

  if (outputFile && diff) {
    fs.writeFileSync(outputFile, `${diff}\n`);
  } else if (outputFile && fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  } else if (diff) {
    process.stdout.write(`${diff}\n`);
  }

  if (diff) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
