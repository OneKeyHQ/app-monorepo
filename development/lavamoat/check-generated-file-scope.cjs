// cspell:ignore LavaMoat lavamoat

const { spawnSync } = require('child_process');
const fs = require('fs');

const { LavaMoatError } = require('./error.cjs');
const { isGeneratedPolicyFile } = require('./generated-files.cjs');

function runGit(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new LavaMoatError(
      `git ${args.join(' ')} failed with status ${result.status}:\n${result.stderr}`,
    );
  }

  return result.stdout;
}

function main() {
  // NUL output preserves literal names; disabling rename detection includes
  // both endpoints so a move from outside the generated scope cannot pass.
  const changedFiles = runGit([
    'status',
    '--porcelain=v1',
    '-z',
    '--no-renames',
    '--untracked-files=all',
  ])
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.slice(3));
  const unexpectedFiles = changedFiles.filter(
    (file) => !isGeneratedPolicyFile(file),
  );
  if (changedFiles.length > 0) {
    const indexEntries = runGit([
      '--literal-pathspecs',
      'ls-files',
      '--stage',
      '-z',
      '--',
      ...changedFiles,
    ])
      .split('\0')
      .filter(Boolean);
    for (const entry of indexEntries) {
      const file = entry.slice(entry.indexOf('\t') + 1);
      const mode = entry.slice(0, entry.indexOf(' '));
      if (mode !== '100644') {
        unexpectedFiles.push(`${file} (index mode ${mode})`);
      }
    }
    for (const file of changedFiles) {
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      if (stat && (!stat.isFile() || (stat.mode & 0o111) !== 0)) {
        unexpectedFiles.push(`${file} (unsafe working tree file mode)`);
      }
    }
  }

  if (unexpectedFiles.length > 0) {
    console.error(
      [
        'Unexpected files or unsafe file modes outside generated LavaMoat policies and review reports:',
        ...unexpectedFiles.map((file) => `- ${file}`),
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    'Generated LavaMoat changes are scoped to policies and review reports.',
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
