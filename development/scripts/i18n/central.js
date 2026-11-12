// App translations come from OneKeyHQ/onekey-i18n: released bundles for normal
// pulls, or a local checkout while an onekey-i18n PR is still open.

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const CENTRAL_REPO = 'OneKeyHQ/onekey-i18n';
const PROJECT_SLUG = 'app';
// Project identity recorded in workflow sync records and plans.
const PROJECT_ID = `${CENTRAL_REPO}/${PROJECT_SLUG}`;
const ASSET = `${PROJECT_SLUG}.bundle.json`;
const BUNDLE_FORMAT = 1;
const LOCALE_ROOT = 'packages/shared/src/locale';
const LOCK_PATH = `${LOCALE_ROOT}/i18n.lock.json`;

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** Local onekey-i18n checkout: $ONEKEY_I18N_DIR or a sibling of this repository. */
function centralDir(root = ROOT) {
  const dir = path.resolve(
    process.env.ONEKEY_I18N_DIR || path.join(root, '..', 'onekey-i18n'),
  );
  if (
    !fs.existsSync(path.join(dir, 'projects', PROJECT_SLUG, 'project.json')) ||
    !fs.existsSync(path.join(dir, 'tools', 'i18n.mjs'))
  )
    throw new Error(
      `No onekey-i18n checkout at ${dir}. Clone ${CENTRAL_REPO} next to this repository or set ONEKEY_I18N_DIR.`,
    );
  return dir;
}

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

function readTree(dir, prefix = '') {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      Object.assign(files, readTree(path.join(dir, entry.name), relative));
    else files[relative] = fs.readFileSync(path.join(dir, entry.name), 'utf8');
  }
  return files;
}

/** Export the app files from a local checkout, including uncommitted edits. */
function fromCheckout(dir) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-i18n-app-'));
  try {
    execFileSync(
      process.execPath,
      [path.join(dir, 'tools', 'export.mjs'), PROJECT_SLUG, '--out', out],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    return {
      source: 'local',
      commit: git(dir, ['rev-parse', 'HEAD']),
      dirty: Boolean(
        git(dir, ['status', '--porcelain', '--', `projects/${PROJECT_SLUG}`]),
      ),
      files: readTree(out),
    };
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

function parseSums(text) {
  const sums = {};
  for (const line of text.split('\n')) {
    const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line.trim());
    if (match) sums[match[2]] = match[1];
  }
  return sums;
}

function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(
      `gh ${args.slice(0, 2).join(' ')} failed (${detail}). Install gh and run gh auth login with access to ${CENTRAL_REPO}.`,
      { cause: error },
    );
  }
}

/** Download the app bundle of one release (latest by default) and verify SHA256SUMS. */
function fromRelease({ tag } = {}) {
  const resolvedTag =
    tag ||
    JSON.parse(
      gh(['release', 'view', '--repo', CENTRAL_REPO, '--json', 'tagName']),
    ).tagName;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-i18n-release-'));
  try {
    gh([
      'release',
      'download',
      resolvedTag,
      '--repo',
      CENTRAL_REPO,
      '--pattern',
      ASSET,
      '--pattern',
      'SHA256SUMS',
      '--dir',
      dir,
    ]);
    const text = fs.readFileSync(path.join(dir, ASSET), 'utf8');
    const expected = parseSums(
      fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8'),
    )[ASSET];
    const actual = sha256(text);
    if (expected !== actual)
      throw new Error(`${ASSET} of ${resolvedTag} does not match SHA256SUMS.`);
    const bundle = JSON.parse(text);
    if (bundle.format !== BUNDLE_FORMAT || bundle.project !== PROJECT_SLUG)
      throw new Error(`${ASSET} of ${resolvedTag} has an unexpected format.`);
    return {
      source: 'release',
      tag: resolvedTag,
      commit: bundle.source?.commit,
      bundleSha256: actual,
      files: bundle.files,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Digest of generated files, independent of the order they are listed in. */
function filesDigest(files) {
  const hash = crypto.createHash('sha256');
  for (const relative of Object.keys(files).toSorted()) {
    hash.update(relative).update('\0').update(files[relative]).update('\0');
  }
  return hash.digest('hex');
}

function assertSafePath(relative) {
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.split('/').some((part) => part === '..' || part === '')
  )
    throw new Error(`Unsafe path in exported files: ${relative}`);
}

/** Write exported files under LOCALE_ROOT and record them in i18n.lock.json. */
function writeLocaleFiles(outputRoot, result) {
  const localeRoot = path.join(outputRoot, LOCALE_ROOT);
  for (const relative of Object.keys(result.files)) assertSafePath(relative);
  // Locale JSON files that left the export must not linger.
  const jsonDir = path.join(localeRoot, 'json');
  if (fs.existsSync(jsonDir)) {
    for (const name of fs.readdirSync(jsonDir)) {
      if (
        name.endsWith('.json') &&
        !Object.hasOwn(result.files, `json/${name}`)
      )
        fs.unlinkSync(path.join(jsonDir, name));
    }
  }
  for (const [relative, content] of Object.entries(result.files)) {
    const target = path.join(localeRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const lock = {
    repo: CENTRAL_REPO,
    project: PROJECT_SLUG,
    source: result.source,
    ...(result.tag ? { tag: result.tag } : {}),
    commit: result.commit,
    ...(result.source === 'local' ? { dirty: result.dirty } : {}),
    ...(result.bundleSha256 ? { bundleSha256: result.bundleSha256 } : {}),
    filesSha256: filesDigest(result.files),
    files: Object.keys(result.files).toSorted(),
  };
  fs.writeFileSync(
    path.join(outputRoot, LOCK_PATH),
    `${JSON.stringify(lock, null, 2)}\n`,
  );
  return lock;
}

/**
 * Check generated files against i18n.lock.json. Files pulled from a local
 * checkout are rejected unless allowLocal: they must come from a release
 * before the change can merge.
 */
function verifyLock(root = ROOT, { allowLocal = false } = {}) {
  const lockFile = path.join(root, LOCK_PATH);
  if (!fs.existsSync(lockFile))
    throw new Error(`${LOCK_PATH} is missing; run yarn i18n:pull.`);
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  if (lock.source !== 'release' && !allowLocal)
    throw new Error(
      `Locale files come from a local onekey-i18n checkout (${lock.commit}${lock.dirty ? ', uncommitted' : ''}). Merge the onekey-i18n PR, then run yarn i18n:pull to pin its release.`,
    );
  const localeRoot = path.join(root, LOCALE_ROOT);
  const jsonDir = path.join(localeRoot, 'json');
  const extra = fs
    .readdirSync(jsonDir)
    .filter(
      (name) => name.endsWith('.json') && !lock.files.includes(`json/${name}`),
    );
  if (extra.length)
    throw new Error(
      `Locale files missing from ${LOCK_PATH}: ${extra.join(', ')}`,
    );
  const files = {};
  for (const relative of lock.files) {
    assertSafePath(relative);
    files[relative] = fs.readFileSync(path.join(localeRoot, relative), 'utf8');
  }
  if (filesDigest(files) !== lock.filesSha256)
    throw new Error(
      `Generated locale files differ from ${LOCK_PATH}. Do not edit them by hand; change copy in ${CENTRAL_REPO} and run yarn i18n:pull.`,
    );
  return lock;
}

module.exports = {
  ROOT,
  CENTRAL_REPO,
  PROJECT_SLUG,
  PROJECT_ID,
  LOCALE_ROOT,
  LOCK_PATH,
  centralDir,
  fromCheckout,
  fromRelease,
  filesDigest,
  git,
  parseSums,
  writeLocaleFiles,
  verifyLock,
};
