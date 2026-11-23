#!/usr/bin/env node
/* cspell:words numstat */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PATCH_DIRS = ['patches', 'apps/desktop/app/patches'];

function lintPatchFiles(rootDir) {
  const patches = PATCH_DIRS.flatMap((directory) =>
    fs
      .readdirSync(path.join(rootDir, directory))
      .filter((name) => name.endsWith('.patch'))
      .toSorted()
      .map((name) => `${directory}/${name}`),
  );
  const gitOptions = { cwd: rootDir, encoding: 'utf8' };
  const attributes = execFileSync(
    'git',
    ['check-attr', '-z', 'text', '--stdin'],
    {
      ...gitOptions,
      input: patches.map((file) => `${file}\0`).join(''),
    },
  ).split('\0');
  const errors = [];
  for (let index = 0; index < attributes.length - 1; index += 3) {
    const file = attributes[index];
    if (attributes[index + 2] !== 'unset') {
      errors.push(
        `${file}: set -text in .gitattributes to preserve patch bytes.`,
      );
    }

    // --numstat parses the patch without applying it or needing its inputs.
    const result = spawnSync('git', ['apply', '--numstat', '--', file], {
      ...gitOptions,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      errors.push(`${file}: ${result.stderr.trim() || 'git apply failed.'}`);
    }
  }
  return { patchCount: patches.length, errors };
}

if (require.main === module) {
  const { patchCount, errors } = lintPatchFiles(
    path.resolve(__dirname, '../..'),
  );
  if (errors.length) {
    console.error(`[patch-files] failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`[patch-files] passed (${patchCount} patches)`);
  }
}

module.exports = { lintPatchFiles };
