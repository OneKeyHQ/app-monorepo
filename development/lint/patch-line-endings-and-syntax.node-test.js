/* cspell:words autocrlf */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  checkPatchLineEndingsAndSyntax,
} = require('./patch-line-endings-and-syntax');

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
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-lint-'));
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
  const { errors } = checkPatchLineEndingsAndSyntax(rootDir);
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
  assert.deepEqual(checkPatchLineEndingsAndSyntax(rootDir), {
    patchCount: 2,
    errors: [],
    restoredFiles: [],
  });
});

test('reports a patch made invalid by CRLF conversion', (t) => {
  const { rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  assert.deepEqual(checkPatchLineEndingsAndSyntax(rootDir).errors, []);
  fs.writeFileSync(
    path.join(rootDir, DESKTOP_PATCH),
    PATCH.replaceAll('\n', '\r\n'),
  );

  const { errors } = checkPatchLineEndingsAndSyntax(rootDir);
  assert.equal(errors.length, 1);
  assert(errors[0].startsWith(`${DESKTOP_PATCH}: `));
});

test('reports stale CRLF even when Git still parses the patch', (t) => {
  const { git, rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  const patchPath = path.join(rootDir, ROOT_PATCH);
  const parseablePatch = PATCH.replaceAll('\n\n', '\n \n');
  fs.writeFileSync(patchPath, parseablePatch);
  git('add', '--', ROOT_PATCH);
  const stalePatch = parseablePatch.replaceAll('\n', '\r\n');
  fs.writeFileSync(patchPath, stalePatch);
  git('apply', '--numstat', '--whitespace=nowarn', '--', ROOT_PATCH);

  const report = checkPatchLineEndingsAndSyntax(rootDir);
  assert.equal(report.errors.length, 1);
  assert(report.errors[0].startsWith(`${ROOT_PATCH}: `));
  assert(
    report.errors[0].includes('yarn lint:patch-line-endings-and-syntax --fix'),
  );
  assert.equal(fs.readFileSync(patchPath, 'utf8'), stalePatch);

  const repaired = checkPatchLineEndingsAndSyntax(rootDir, { fix: true });
  assert.deepEqual(repaired.errors, []);
  assert.deepEqual(repaired.restoredFiles, [ROOT_PATCH]);
  assert.equal(fs.readFileSync(patchPath, 'utf8'), parseablePatch);
});

test('parses valid patches with a strict Git whitespace setting', (t) => {
  const { git, rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  git('config', 'apply.whitespace', 'error');
  fs.writeFileSync(
    path.join(rootDir, ROOT_PATCH),
    PATCH.replace('+const version = 2;', '+const version = 2;  '),
  );

  assert.deepEqual(checkPatchLineEndingsAndSyntax(rootDir).errors, []);
});

test('restores stale checkout bytes while preserving local patch edits', (t) => {
  const { git, rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  const rootPatchPath = path.join(rootDir, ROOT_PATCH);
  const desktopPatchPath = path.join(rootDir, DESKTOP_PATCH);
  const indexedPatch = PATCH.replace(
    ' const start = 0;\n',
    ' const start = 0;\r\n',
  );
  fs.writeFileSync(rootPatchPath, indexedPatch);
  git('add', '--', ROOT_PATCH, DESKTOP_PATCH);
  const stalePatch = PATCH.replaceAll('\n', '\r\n');
  const editedPatch = stalePatch.replace(
    '+const version = 2;',
    '+const version = 3;',
  );
  fs.writeFileSync(rootPatchPath, stalePatch);
  fs.writeFileSync(desktopPatchPath, editedPatch);

  const report = checkPatchLineEndingsAndSyntax(rootDir);
  assert.equal(report.errors.length, 2);
  assert(report.errors[0].startsWith(`${ROOT_PATCH}: `));
  assert(
    report.errors[0].includes('yarn lint:patch-line-endings-and-syntax --fix'),
  );
  assert(report.errors[1].startsWith(`${DESKTOP_PATCH}: `));
  assert.equal(fs.readFileSync(rootPatchPath, 'utf8'), stalePatch);

  const repaired = checkPatchLineEndingsAndSyntax(rootDir, { fix: true });
  assert.deepEqual(repaired.restoredFiles, [ROOT_PATCH]);
  assert.deepEqual(repaired.errors, [report.errors[1]]);
  assert.equal(fs.readFileSync(rootPatchPath, 'utf8'), indexedPatch);
  assert.equal(fs.readFileSync(desktopPatchPath, 'utf8'), editedPatch);
  assert.equal(git('show', `:${ROOT_PATCH}`).toString('utf8'), indexedPatch);
});

test('restores a checkout cached by Git before the attributes changed', (t) => {
  const { git, rootDir } = setupFixture(t);
  const patchPath = path.join(rootDir, ROOT_PATCH);
  git('add', '--', ROOT_PATCH, DESKTOP_PATCH);
  fs.unlinkSync(patchPath);
  git('checkout-index', '--index', '--', ROOT_PATCH);
  assert.equal(
    fs.readFileSync(patchPath, 'utf8'),
    PATCH.replaceAll('\n', '\r\n'),
  );
  copyRepositoryAttributes(rootDir);

  const result = checkPatchLineEndingsAndSyntax(rootDir, { fix: true });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.restoredFiles, [ROOT_PATCH]);
  assert.equal(fs.readFileSync(patchPath, 'utf8'), PATCH);
});

test(
  'preserves patch permissions when the umask is more restrictive',
  { skip: process.platform === 'win32' },
  (t) => {
    const { git, rootDir } = setupFixture(t);
    copyRepositoryAttributes(rootDir);
    const patchPath = path.join(rootDir, ROOT_PATCH);
    git('add', '--', ROOT_PATCH);
    fs.writeFileSync(patchPath, PATCH.replaceAll('\n', '\r\n'));
    fs.chmodSync(patchPath, 0o664);

    const previousMask = process.umask(0o022);
    try {
      const repaired = checkPatchLineEndingsAndSyntax(rootDir, { fix: true });
      assert.deepEqual(repaired.errors, []);
      assert.deepEqual(repaired.restoredFiles, [ROOT_PATCH]);
      assert.equal(fs.statSync(patchPath).mode & 0o777, 0o664);
      assert.equal(fs.readFileSync(patchPath, 'utf8'), PATCH);
    } finally {
      process.umask(previousMask);
    }
  },
);

test('reports earlier and later repairs when one file cannot be replaced', (t) => {
  const { git, rootDir } = setupFixture(t);
  copyRepositoryAttributes(rootDir);
  const lockedPatch = 'patches/sample+3.0.0.patch';
  const lockedPath = path.join(fs.realpathSync(rootDir), lockedPatch);
  fs.writeFileSync(lockedPath, PATCH);
  const files = [ROOT_PATCH, lockedPatch, DESKTOP_PATCH];
  git('add', '--', ...files);
  const stalePatch = PATCH.replaceAll('\n', '\r\n');
  for (const file of files) {
    fs.writeFileSync(path.join(rootDir, file), stalePatch);
  }

  const renameSync = fs.renameSync;
  t.mock.method(fs, 'renameSync', (source, destination) => {
    if (destination === lockedPath) {
      throw Object.assign(new Error('Test patch is locked'), { code: 'EPERM' });
    }
    return renameSync(source, destination);
  });

  const result = checkPatchLineEndingsAndSyntax(rootDir, { fix: true });
  assert.deepEqual(result.restoredFiles, [ROOT_PATCH, DESKTOP_PATCH]);
  assert.equal(result.errors.length, 1);
  assert(result.errors[0].startsWith(`${lockedPatch}: `));
  assert(result.errors[0].includes('Test patch is locked'));
  assert.equal(fs.readFileSync(lockedPath, 'utf8'), stalePatch);
  for (const file of result.restoredFiles) {
    assert.equal(fs.readFileSync(path.join(rootDir, file), 'utf8'), PATCH);
  }
});
