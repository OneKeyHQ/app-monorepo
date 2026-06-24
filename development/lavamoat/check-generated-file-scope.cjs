const { spawnSync } = require('child_process');

const allowedPrefixes = ['lavamoat/'];

function runGit(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed with status ${result.status}:\n${result.stderr}`,
    );
  }

  return result.stdout;
}

function parseStatusLine(line) {
  const file = line.slice(3);
  return file.includes(' -> ') ? file.split(' -> ') : [file];
}

function isAllowed(file) {
  return allowedPrefixes.some((prefix) => file.startsWith(prefix));
}

function main() {
  const status = runGit(['status', '--porcelain=v1', '--untracked-files=all']);
  const unexpectedFiles = status
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap(parseStatusLine)
    .filter((file) => !isAllowed(file));

  if (unexpectedFiles.length > 0) {
    console.error(
      [
        'Unexpected non-LavaMoat files changed while generating LavaMoat policies:',
        ...unexpectedFiles.map((file) => `- ${file}`),
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  console.log('Generated LavaMoat changes are scoped to lavamoat/.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
