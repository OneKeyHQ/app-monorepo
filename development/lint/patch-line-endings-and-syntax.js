#!/usr/bin/env node
/* cspell:words numstat */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const PATCH_DIRS = ['patches', 'apps/desktop/app/patches'];
const FIX_COMMAND = 'yarn lint:patch-line-endings-and-syntax --fix';
const PARSE_PATCH_ARGS = ['apply', '--numstat', '--whitespace=nowarn'];

function runGit(args, options) {
  const result = spawnSync('git', args, options);
  if (result.error) {
    throw result.error;
  }
  return result;
}

function getStaleCheckoutPatch(rootDir, file) {
  const patchPath = path.join(fs.realpathSync(rootDir), file);
  const stat = fs.lstatSync(patchPath);
  if (!stat.isFile() || fs.realpathSync(patchPath) !== patchPath) {
    return null;
  }

  // Use a byte-preserving encoding so comparisons also cover non-UTF-8 hunks.
  const worktreePatch = fs.readFileSync(patchPath, 'latin1');
  if (!worktreePatch.includes('\r\n')) {
    return null;
  }

  const indexed = runGit(['show', `:${file}`], { cwd: rootDir });
  if (indexed.status !== 0) {
    return null;
  }
  const indexedPatch = indexed.stdout.toString('latin1');
  if (
    worktreePatch === indexedPatch ||
    worktreePatch !== indexedPatch.replace(/(?<!\r)\n/gu, '\r\n')
  ) {
    return null;
  }

  const result = runGit(PARSE_PATCH_ARGS, {
    cwd: rootDir,
    input: indexed.stdout,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  return result.status === 0
    ? {
        indexedBytes: indexed.stdout,
        worktreePatch,
        mode: stat.mode,
        patchPath,
      }
    : null;
}

function restoreStaleCheckout(stale) {
  const { patchPath } = stale;
  const tempDir = fs.mkdtempSync(
    path.join(path.dirname(patchPath), '.patch-restore-'),
  );
  const tempPatch = path.join(tempDir, 'patch');
  try {
    fs.writeFileSync(tempPatch, stale.indexedBytes, { mode: stale.mode });
    fs.chmodSync(tempPatch, stale.mode);
    if (
      fs.lstatSync(patchPath).mode !== stale.mode ||
      fs.realpathSync(patchPath) !== patchPath ||
      fs.readFileSync(patchPath, 'latin1') !== stale.worktreePatch
    ) {
      return false;
    }
    // The index can still cache the old checkout as clean and skip rewriting it.
    fs.renameSync(tempPatch, patchPath);
    return true;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function checkPatchLineEndingsAndSyntax(rootDir, { fix = false } = {}) {
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
  const restoredFiles = [];
  for (let index = 0; index < attributes.length - 1; index += 3) {
    const file = attributes[index];
    const preservesPatchBytes = attributes[index + 2] === 'unset';
    if (!preservesPatchBytes) {
      errors.push(
        `${file}: set -text in .gitattributes to preserve patch bytes.`,
      );
    }

    let staleCheckout;
    let checkoutError;
    if (preservesPatchBytes) {
      try {
        staleCheckout = getStaleCheckoutPatch(rootDir, file);
        if (fix && staleCheckout) {
          if (restoreStaleCheckout(staleCheckout)) {
            restoredFiles.push(file);
          }
          staleCheckout = null;
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const action = fix ? 'restore' : 'inspect';
        checkoutError = `${file}: failed to ${action} patch: ${detail}`;
      }
    }

    if (checkoutError) {
      errors.push(checkoutError);
    } else {
      // --numstat parses the patch without applying it or needing its inputs.
      const result = runGit([...PARSE_PATCH_ARGS, '--', file], {
        ...gitOptions,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      if (result.status !== 0 || staleCheckout) {
        const diagnostic =
          result.status !== 0
            ? result.stderr.trim() || 'git apply failed.'
            : '';
        const hint = staleCheckout
          ? `This checkout contains stale CRLF line endings. Run ${FIX_COMMAND} to restore the index bytes.`
          : '';
        errors.push(`${file}: ${[diagnostic, hint].filter(Boolean).join(' ')}`);
      }
    }
  }
  return { patchCount: patches.length, errors, restoredFiles };
}

if (require.main === module) {
  const { values } = parseArgs({ options: { fix: { type: 'boolean' } } });
  const { patchCount, errors, restoredFiles } = checkPatchLineEndingsAndSyntax(
    path.resolve(__dirname, '../..'),
    { fix: values.fix },
  );
  for (const file of restoredFiles) {
    console.log(
      `[patch-line-endings-and-syntax] restored ${file} from the Git index`,
    );
  }
  if (errors.length) {
    console.error(
      `[patch-line-endings-and-syntax] failed:\n- ${errors.join('\n- ')}`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `[patch-line-endings-and-syntax] passed (${patchCount} patches)`,
    );
  }
}

module.exports = { checkPatchLineEndingsAndSyntax };
