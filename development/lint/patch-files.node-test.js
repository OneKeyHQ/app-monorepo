/* cspell:words autocrlf */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { lintPatchFiles } = require('./patch-files');

const ROOT_PATCH = 'patches/sample+1.0.0.patch';
const DESKTOP_PATCH = 'apps/desktop/app/patches/sample+2.0.0.patch';
const PATCH = [
  'diff --git a/index.js b/index.js',
  '--- a/index.js',
  '+++ b/index.js',
  '@@ -1,3 +1,3 @@',
  ' const start = 0;',
  '',
  '-const version = 1;',
  '+const version = 2;',
  '',
].join('\n');

function setupFixture(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-files-lint-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: rootDir, stdio: 'pipe' });
  git('init', '--quiet');
  git('config', 'core.autocrlf', 'true');
  for (const file of [ROOT_PATCH, DESKTOP_PATCH]) {
    fs.mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
    fs.writeFileSync(path.join(rootDir, file), PATCH);
  }
  return { git, rootDir };
}

function copyRepositoryAttributes(rootDir) {
  fs.copyFileSync(
    path.resolve(__dirname, '../../.gitattributes'),
    path.join(rootDir, '.gitattributes'),
  );
}

test('requires byte-preserving attributes in both patch directories', (t) => {
  const { rootDir } = setupFixture(t);
  const { errors } = lintPatchFiles(rootDir);
  assert.equal(errors.length, 2);
  assert(errors.some((error) => error.startsWith(`${ROOT_PATCH}: set -text`)));
  assert(
    errors.some((error) => error.startsWith(`${DESKTOP_PATCH}: set -text`)),
  );
});

test('preserves LF and mixed patch bytes on a checkout with autocrlf', (t) => {
  const { git, rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  const mixedPatch = PATCH.replace(
    ' const start = 0;\n',
    ' const start = 0;\r\n',
  );
  fs.writeFileSync(path.join(rootDir, DESKTOP_PATCH), mixedPatch);
  git('add', '--', '.gitattributes', ROOT_PATCH, DESKTOP_PATCH);
  for (const file of [ROOT_PATCH, DESKTOP_PATCH]) {
    fs.unlinkSync(path.join(rootDir, file));
  }
  git('checkout-index', '--', ROOT_PATCH, DESKTOP_PATCH);

  assert.equal(fs.readFileSync(path.join(rootDir, ROOT_PATCH), 'utf8'), PATCH);
  assert.equal(
    fs.readFileSync(path.join(rootDir, DESKTOP_PATCH), 'utf8'),
    mixedPatch,
  );
  assert.deepEqual(lintPatchFiles(rootDir), { patchCount: 2, errors: [] });
});

test('reports a patch made invalid by CRLF conversion', (t) => {
  const { rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  fs.writeFileSync(
    path.join(rootDir, DESKTOP_PATCH),
    PATCH.replaceAll('\n', '\r\n'),
  );

  const { errors } = lintPatchFiles(rootDir);
  assert.equal(errors.length, 1);
  assert(errors[0].startsWith(`${DESKTOP_PATCH}: `));
  assert.match(errors[0], /corrupt patch at line 6/u);
});
