#!/usr/bin/env node
// Fills the brand sans font slot used by every platform.
//
// The licensed brand typeface must not be committed to this public repository,
// so the slot is generated at install time from the first available source:
//   1. ONEKEY_PRIVATE_FONTS_DIR — a directory holding the licensed font files.
//   2. The private GitHub repo pinned in fonts/brand.lock.json, read with
//      ONEKEY_PRIVATE_FONTS_TOKEN or, when that is unset, the local
//      `gh auth token`. Every downloaded file must match the locked sha256.
//   3. fonts/fallback/ — open-source Inter (SIL OFL 1.1), always committed.
// Private faces from any source must match the sha256 pinned in brand.lock.json.
// A source directory must contain one .ttf per weight 400/500/600/700, matched
// by OS/2 usWeightClass, so file names inside it do not matter.
//
// Outputs (all gitignored):
//   - fonts/brand/BrandSans-<Weight>.ttf: fixed slot names that JS, web CSS and
//     the iOS Xcode project reference statically.
//   - fonts/brand/manifest.ts: PostScript names. iOS resolves native fontFamily
//     by PostScript name, so JS needs the real names of the installed faces.
//   - Android assets/fonts/<PostScript>.ttf: ReactFontManager resolves
//     fontFamily by asset file name before expo-font registers anything.
//
// Env:
//   ONEKEY_PRIVATE_FONTS_TOKEN      GitHub token with contents:read on the private
//                                   font repo. A token that cannot fetch is an error.
//   ONEKEY_PRIVATE_FONTS_REPO       owner/name overriding brand.lock.json `repo`
//                                   (e.g. a mirror); commit and sha256 still apply.
//   ONEKEY_FONTS_FORCE_FALLBACK=1   Ignore private sources (preview the OSS build).
//   ONEKEY_REQUIRE_PRIVATE_FONTS=1  Fail instead of falling back (release builds).

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getPostScriptName, getWeightClass } = require('./font-file-utils');

const rootDir = path.resolve(__dirname, '../..');
const fontsDir = path.join(
  rootDir,
  'packages/components/src/hocs/Provider/fonts',
);
const brandDir = path.join(fontsDir, 'brand');
const lockPath = path.join(fontsDir, 'brand.lock.json');
const remoteCacheRoot = path.join(
  rootDir,
  'node_modules/.cache/onekey-private-fonts',
);
const fallbackDir = path.join(fontsDir, 'fallback');
const androidFontsDir = path.join(
  rootDir,
  'apps/mobile/android/app/src/main/assets/fonts',
);
// Android assets that are committed and owned by other font registrations.
const androidCommittedFontPattern = /^GeistMono-.+\.ttf$/;

const SLOTS = [
  { key: 'regular', weight: 400, fileName: 'BrandSans-Regular.ttf' },
  { key: 'medium', weight: 500, fileName: 'BrandSans-Medium.ttf' },
  { key: 'semibold', weight: 600, fileName: 'BrandSans-SemiBold.ttf' },
  { key: 'bold', weight: 700, fileName: 'BrandSans-Bold.ttf' },
];

const log = (msg) => console.log(`[fonts:sync] ${msg}`);

function isEnabled(name, env = process.env) {
  return ['1', 'true'].includes(String(env[name] || '').toLowerCase());
}

// The private source exists but this machine cannot reach it (no access,
// network failure). Only an explicitly configured token turns this into an error.
class RemoteFontsUnavailableError extends Error {}

function loadDotEnv() {
  try {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: path.join(rootDir, '.env'), quiet: true });
  } catch {
    // dotenv is optional during a partial install.
  }
}

// Returns slot key -> absolute file path, or throws describing what is missing.
function readWeightSet(dir) {
  const byWeight = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (name.toLowerCase().endsWith('.ttf')) {
      const filePath = path.join(dir, name);
      const weight = getWeightClass(filePath);
      if (byWeight.has(weight)) {
        throw new Error(
          `${dir} has more than one font with weight ${weight}: ${path.basename(
            byWeight.get(weight),
          )}, ${name}`,
        );
      }
      byWeight.set(weight, filePath);
    }
  }
  const files = {};
  for (const slot of SLOTS) {
    const filePath = byWeight.get(slot.weight);
    if (!filePath) {
      throw new Error(`${dir} has no font with weight ${slot.weight}`);
    }
    files[slot.key] = filePath;
  }
  return files;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// GitHub owners are alphanumeric/hyphen; a repo name may not be '.' or '..'.
const REPO_PATTERN = /^[A-Za-z0-9-]+\/(?!\.\.?$)[\w.-]+$/;

// Throws unless every slot file matches the sha256 pinned in the lock, so a
// misconfigured or tampered directory can never be reported as private.
function verifyAgainstLock(files, lock, origin) {
  for (const slot of SLOTS) {
    const actual = sha256(fs.readFileSync(files[slot.key]));
    if (actual !== lock.files[slot.key].sha256) {
      throw new Error(
        `${origin}: ${slot.key} sha256 ${actual} does not match brand.lock.json ${
          lock.files[slot.key].sha256
        }`,
      );
    }
  }
}

function readLock(filePath = lockPath) {
  const lock = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!REPO_PATTERN.test(lock.repo || '')) {
    throw new Error(`${filePath}: invalid repo ${JSON.stringify(lock.repo)}`);
  }
  // null until the private repo is published; the remote source is skipped.
  if (lock.commit !== null && !/^[0-9a-f]{40}$/.test(lock.commit || '')) {
    throw new Error(`${filePath}: commit must be a full SHA or null`);
  }
  for (const slot of SLOTS) {
    const entry = lock.files && lock.files[slot.key];
    if (
      !entry ||
      typeof entry.path !== 'string' ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 || '')
    ) {
      throw new Error(`${filePath}: missing path/sha256 for ${slot.key}`);
    }
  }
  return lock;
}

function readGhToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    }).trim();
  } catch {
    // gh is optional; contributors without it use the next source.
    return '';
  }
}

// Downloads the locked files into a per-commit cache and verifies each one.
// Returns slot key -> absolute file path.
async function fetchLockedFonts(
  lock,
  token,
  { cacheRoot = remoteCacheRoot, fetchImpl = fetch } = {},
) {
  const cacheDir = path.join(cacheRoot, lock.commit);
  fs.mkdirSync(cacheDir, { recursive: true });
  const files = {};
  for (const slot of SLOTS) {
    const entry = lock.files[slot.key];
    const target = path.join(cacheDir, `${slot.key}.ttf`);
    if (
      !fs.existsSync(target) ||
      sha256(fs.readFileSync(target)) !== entry.sha256
    ) {
      const url = `https://api.github.com/repos/${
        lock.repo
      }/contents/${entry.path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}?ref=${lock.commit}`;
      let response;
      try {
        response = await fetchImpl(url, {
          headers: {
            Accept: 'application/vnd.github.raw+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'onekey-fonts-sync',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(60_000),
        });
      } catch (error) {
        throw new RemoteFontsUnavailableError(
          `Cannot reach ${lock.repo}: ${error.message}`,
        );
      }
      if (!response.ok) {
        throw new RemoteFontsUnavailableError(
          `GET ${lock.repo}/${entry.path}@${lock.commit.slice(
            0,
            12,
          )} failed with HTTP ${response.status}`,
        );
      }
      const content = Buffer.from(await response.arrayBuffer());
      const actual = sha256(content);
      if (actual !== entry.sha256) {
        // Integrity failure: never fall back silently, the lock or repo is wrong.
        throw new Error(
          `${lock.repo}/${entry.path} sha256 ${actual} does not match brand.lock.json ${entry.sha256}`,
        );
      }
      fs.writeFileSync(target, content);
    }
    const weight = getWeightClass(target);
    if (weight !== slot.weight) {
      throw new Error(
        `${lock.repo}/${entry.path} has weight ${weight}, expected ${slot.weight} for ${slot.key}`,
      );
    }
    files[slot.key] = target;
  }
  return files;
}

async function resolveRemoteSource({
  env,
  lock,
  getGhToken,
  fetchImpl,
  cacheRoot,
}) {
  const explicitToken = String(env.ONEKEY_PRIVATE_FONTS_TOKEN || '').trim();
  const repoOverride = String(env.ONEKEY_PRIVATE_FONTS_REPO || '').trim();
  if (repoOverride && !REPO_PATTERN.test(repoOverride)) {
    throw new Error(
      `ONEKEY_PRIVATE_FONTS_REPO must be owner/name, got ${JSON.stringify(
        repoOverride,
      )}`,
    );
  }
  const lockedRepo = lock || readLock();
  const resolvedLock = repoOverride
    ? { ...lockedRepo, repo: repoOverride }
    : lockedRepo;
  if (resolvedLock.commit === null) {
    if (explicitToken) {
      log(
        'ONEKEY_PRIVATE_FONTS_TOKEN is set but brand.lock.json pins no commit yet; skipping the private repo.',
      );
    }
    return null;
  }
  const token = explicitToken || getGhToken();
  if (!token) {
    return null;
  }
  try {
    const files = await fetchLockedFonts(resolvedLock, token, {
      cacheRoot,
      fetchImpl,
    });
    return {
      source: 'private',
      origin: `${resolvedLock.repo}@${resolvedLock.commit.slice(0, 12)}`,
      files,
    };
  } catch (error) {
    if (explicitToken || !(error instanceof RemoteFontsUnavailableError)) {
      throw error;
    }
    // A gh login without access to the private repo is the normal case for
    // contributors outside OneKey.
    log(`private font repo not available via gh (${error.message})`);
    return null;
  }
}

async function resolveSource({
  env = process.env,
  lock,
  getGhToken = readGhToken,
  fetchImpl = fetch,
  cacheRoot = remoteCacheRoot,
} = {}) {
  if (!isEnabled('ONEKEY_FONTS_FORCE_FALLBACK', env)) {
    const configuredDir = env.ONEKEY_PRIVATE_FONTS_DIR;
    if (configuredDir) {
      // An explicit configuration that does not work is an error, not a fallback.
      const dir = path.resolve(rootDir, configuredDir);
      const files = readWeightSet(dir);
      verifyAgainstLock(files, lock || readLock(), dir);
      return { source: 'private', origin: dir, files };
    }
    const remote = await resolveRemoteSource({
      env,
      lock,
      getGhToken,
      fetchImpl,
      cacheRoot,
    });
    if (remote) {
      return remote;
    }
  }
  return {
    source: 'fallback',
    origin: path.relative(rootDir, fallbackDir),
    files: readWeightSet(fallbackDir),
  };
}

// Local installs must never fail because of the private font: a broken
// private source degrades to the committed fallback with a warning. Only
// release builds (ONEKEY_REQUIRE_PRIVATE_FONTS=1) treat it as fatal.
async function resolveSourceOrFallback(options = {}) {
  const env = options.env ?? process.env;
  try {
    return await resolveSource(options);
  } catch (error) {
    if (isEnabled('ONEKEY_REQUIRE_PRIVATE_FONTS', env)) {
      throw error;
    }
    log(`private brand font unavailable, falling back: ${error.message}`);
    return {
      source: 'fallback',
      origin: path.relative(rootDir, fallbackDir),
      files: readWeightSet(fallbackDir),
    };
  }
}

function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(content)) {
    return false;
  }
  fs.writeFileSync(filePath, content);
  return true;
}

function renderManifest(source, nativeFamily) {
  const lines = SLOTS.map(
    (slot) => `    ${slot.key}: '${nativeFamily[slot.key]}',`,
  );
  return [
    '// Generated by development/scripts/fonts-sync.js. Do not edit or commit.',
    'export const brandFontManifest = {',
    `  source: '${source}',`,
    '  nativeFamily: {',
    ...lines,
    '  },',
    '} as const;',
    '',
  ].join('\n');
}

function syncAndroidAssets(nativeFamily, files) {
  fs.mkdirSync(androidFontsDir, { recursive: true });
  const expected = new Set(
    SLOTS.map((slot) => `${nativeFamily[slot.key]}.ttf`),
  );
  for (const name of fs.readdirSync(androidFontsDir)) {
    if (
      name.endsWith('.ttf') &&
      !androidCommittedFontPattern.test(name) &&
      !expected.has(name)
    ) {
      // Stale faces from a previously synced source would still ship in the APK.
      fs.rmSync(path.join(androidFontsDir, name));
    }
  }
  for (const slot of SLOTS) {
    writeIfChanged(
      path.join(androidFontsDir, `${nativeFamily[slot.key]}.ttf`),
      fs.readFileSync(files[slot.key]),
    );
  }
}

async function main() {
  loadDotEnv();
  const { source, origin, files } = await resolveSourceOrFallback();

  if (source !== 'private' && isEnabled('ONEKEY_REQUIRE_PRIVATE_FONTS')) {
    throw new Error(
      'ONEKEY_REQUIRE_PRIVATE_FONTS is set but no private brand font source is available. Set ONEKEY_PRIVATE_FONTS_TOKEN (and pin brand.lock.json) or ONEKEY_PRIVATE_FONTS_DIR.',
    );
  }

  const nativeFamily = {};
  for (const slot of SLOTS) {
    const postScriptName = getPostScriptName(files[slot.key]);
    if (!postScriptName) {
      throw new Error(`Cannot read PostScript name of ${files[slot.key]}`);
    }
    nativeFamily[slot.key] = postScriptName;
  }

  fs.mkdirSync(brandDir, { recursive: true });
  for (const slot of SLOTS) {
    writeIfChanged(
      path.join(brandDir, slot.fileName),
      fs.readFileSync(files[slot.key]),
    );
  }
  writeIfChanged(
    path.join(brandDir, 'manifest.ts'),
    Buffer.from(renderManifest(source, nativeFamily)),
  );
  syncAndroidAssets(nativeFamily, files);

  log(`brand sans: ${source} (${origin})`);
  if (source === 'fallback') {
    log(
      'Using the open-source fallback typeface. Official builds use the licensed brand font.',
    );
  }
}

// EAS uploads the working tree minus gitignored paths, so the synced (ignored)
// brand slot never reaches the EAS builder. CI stages the private faces into a
// non-ignored directory right before `eas build`; eas-build-post-install then
// syncs from it via ONEKEY_PRIVATE_FONTS_DIR. EAS therefore needs no token.
const easStagingDir = path.join(rootDir, '.eas-private-fonts');

function stageForEas() {
  const manifestPath = path.join(brandDir, 'manifest.ts');
  const manifest = fs.existsSync(manifestPath)
    ? fs.readFileSync(manifestPath, 'utf-8')
    : '';
  if (!/^\s+source: 'private',$/m.test(manifest)) {
    throw new Error(
      'The brand slot does not hold the private font; run fonts:sync with access first.',
    );
  }
  const files = Object.fromEntries(
    SLOTS.map((slot) => [slot.key, path.join(brandDir, slot.fileName)]),
  );
  verifyAgainstLock(files, readLock(), path.relative(rootDir, brandDir));
  fs.rmSync(easStagingDir, { recursive: true, force: true });
  fs.mkdirSync(easStagingDir, { recursive: true });
  for (const slot of SLOTS) {
    fs.copyFileSync(
      path.join(brandDir, slot.fileName),
      path.join(easStagingDir, slot.fileName),
    );
  }
  log(
    `staged private brand font for EAS in ${path.relative(rootDir, easStagingDir)}`,
  );
}

if (require.main === module) {
  const run = process.argv.includes('--stage-eas')
    ? async () => stageForEas()
    : main;
  run().catch((error) => {
    console.error(`[fonts:sync] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  RemoteFontsUnavailableError,
  SLOTS,
  fetchLockedFonts,
  readLock,
  readWeightSet,
  renderManifest,
  resolveSource,
  resolveSourceOrFallback,
  sha256,
  verifyAgainstLock,
};
