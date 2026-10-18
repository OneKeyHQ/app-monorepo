const assert = require('assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const os = require('os');
const path = require('path');

const { getPostScriptName } = require('./font-file-utils');
const {
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
} = require('./fonts-sync');

const fontsDir = path.resolve(
  __dirname,
  '../../packages/components/src/hocs/Provider/fonts',
);
const fallbackDir = path.join(fontsDir, 'fallback');

const COMMIT = 'a'.repeat(40);
const fallbackFiles = readWeightSet(fallbackDir);

// A lock that pins the fallback faces so remote tests need no private bytes.
function makeLock(overrides = {}) {
  const files = {};
  for (const slot of SLOTS) {
    files[slot.key] = {
      path: `fonts/${path.basename(fallbackFiles[slot.key])}`,
      sha256: sha256(fs.readFileSync(fallbackFiles[slot.key])),
    };
  }
  return {
    repo: 'OneKeyHQ/app-private-fonts',
    commit: COMMIT,
    files,
    ...overrides,
  };
}

function makeFetch({ status = 200, body } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop());
    const content = body || fs.readFileSync(path.join(fallbackDir, fileName));
    return {
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () =>
        content.buffer.slice(
          content.byteOffset,
          content.byteOffset + content.byteLength,
        ),
    };
  };
  return { calls, fetchImpl };
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fonts-sync-'));
  return Promise.resolve(fn(dir)).finally(() =>
    fs.rmSync(dir, { recursive: true, force: true }),
  );
}

test('committed fallback covers every brand slot with open-source Inter', () => {
  const files = readWeightSet(fallbackDir);
  assert.deepEqual(
    SLOTS.map((slot) => getPostScriptName(files[slot.key])),
    ['Inter-Regular', 'Inter-Medium', 'Inter-SemiBold', 'Inter-Bold'],
  );
});

test('a source directory missing a weight is rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fonts-sync-'));
  try {
    fs.copyFileSync(
      path.join(fallbackDir, 'Inter-Regular.ttf'),
      path.join(dir, 'Any-Name.ttf'),
    );
    assert.throws(() => readWeightSet(dir), /no font with weight 500/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest records the source and native family per slot', () => {
  const manifest = renderManifest('fallback', {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  });
  assert.match(manifest, /source: 'fallback',/);
  assert.match(manifest, /^ {4}semibold: 'Inter-SemiBold',$/m);
});

test('committed lock is well-formed and contains no font bytes', () => {
  const lock = readLock();
  assert.equal(lock.repo, 'OneKeyHQ/app-private-fonts');
  assert.ok(fs.statSync(path.join(fontsDir, 'brand.lock.json')).size < 4096);
});

test('locked fonts are downloaded at the pinned commit, verified and cached', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch();
    const files = await fetchLockedFonts(makeLock(), 'tkn', {
      cacheRoot,
      fetchImpl,
    });
    assert.equal(calls.length, SLOTS.length);
    assert.match(
      calls[0].url,
      new RegExp(
        `^https://api\\.github\\.com/repos/OneKeyHQ/app-private-fonts/contents/fonts/Inter-Regular\\.ttf\\?ref=${COMMIT}$`,
      ),
    );
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tkn');
    assert.equal(getPostScriptName(files.semibold), 'Inter-SemiBold');

    await fetchLockedFonts(makeLock(), 'tkn', { cacheRoot, fetchImpl });
    assert.equal(calls.length, SLOTS.length, 'second run is served from cache');
  }));

test('a download that does not match the lock is rejected and not cached', () =>
  withTempDir(async (cacheRoot) => {
    const { fetchImpl } = makeFetch({ body: Buffer.from('tampered') });
    await assert.rejects(
      fetchLockedFonts(makeLock(), 'tkn', { cacheRoot, fetchImpl }),
      (error) =>
        !(error instanceof RemoteFontsUnavailableError) &&
        /does not match brand\.lock\.json/.test(error.message),
    );
    assert.deepEqual(fs.readdirSync(path.join(cacheRoot, COMMIT)), []);
  }));

test('ONEKEY_PRIVATE_FONTS_DIR wins over the private repo', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch();
    const result = await resolveSource({
      env: {
        ONEKEY_PRIVATE_FONTS_DIR: fallbackDir,
        ONEKEY_PRIVATE_FONTS_TOKEN: 'tkn',
      },
      lock: makeLock(),
      getGhToken: () => 'gh',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(result.origin, fallbackDir);
    assert.equal(calls.length, 0);
  }));

test('the private repo is read with the env token before the gh token', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch();
    const result = await resolveSource({
      env: { ONEKEY_PRIVATE_FONTS_TOKEN: 'env-token' },
      lock: makeLock(),
      getGhToken: () => 'gh-token',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(result.source, 'private');
    assert.equal(
      result.origin,
      `OneKeyHQ/app-private-fonts@${COMMIT.slice(0, 12)}`,
    );
    assert.equal(calls[0].init.headers.Authorization, 'Bearer env-token');
  }));

test('an explicit token that cannot fetch fails instead of falling back', () =>
  withTempDir(async (cacheRoot) => {
    const { fetchImpl } = makeFetch({ status: 404 });
    await assert.rejects(
      resolveSource({
        env: { ONEKEY_PRIVATE_FONTS_TOKEN: 'tkn' },
        lock: makeLock(),
        getGhToken: () => '',
        fetchImpl,
        cacheRoot,
      }),
      /HTTP 404/,
    );
  }));

test('a gh login without repo access falls through to the next source', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch({ status: 404 });
    const result = await resolveSource({
      env: {},
      lock: makeLock(),
      getGhToken: () => 'gh-token',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(calls.length, 1);
    assert.notEqual(
      result.origin,
      `OneKeyHQ/app-private-fonts@${COMMIT.slice(0, 12)}`,
    );
  }));

test('an unpinned lock skips the private repo', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch();
    await resolveSource({
      env: { ONEKEY_PRIVATE_FONTS_TOKEN: 'tkn' },
      lock: makeLock({ commit: null }),
      getGhToken: () => 'gh-token',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(calls.length, 0);
  }));

test('ONEKEY_FONTS_FORCE_FALLBACK ignores every private source', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch();
    const result = await resolveSource({
      env: {
        ONEKEY_FONTS_FORCE_FALLBACK: '1',
        ONEKEY_PRIVATE_FONTS_TOKEN: 'tkn',
      },
      lock: makeLock(),
      getGhToken: () => 'gh-token',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(result.source, 'fallback');
    assert.equal(calls.length, 0);
  }));

test('ONEKEY_PRIVATE_FONTS_REPO overrides the locked repo but keeps commit and hashes', () =>
  withTempDir(async (cacheRoot) => {
    const { calls, fetchImpl } = makeFetch();
    const result = await resolveSource({
      env: {
        ONEKEY_PRIVATE_FONTS_TOKEN: 'tkn',
        ONEKEY_PRIVATE_FONTS_REPO: 'Acme/brand-fonts',
      },
      lock: makeLock(),
      getGhToken: () => '',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(result.origin, `Acme/brand-fonts@${COMMIT.slice(0, 12)}`);
    assert.match(
      calls[0].url,
      /\/repos\/Acme\/brand-fonts\/contents\/.*\?ref=a{40}$/,
    );
    for (const invalid of ['../evil', 'Acme/..', 'Acme']) {
      // eslint-disable-next-line no-await-in-loop
      await assert.rejects(
        resolveSource({
          env: { ONEKEY_PRIVATE_FONTS_REPO: invalid },
          lock: makeLock(),
          getGhToken: () => '',
          fetchImpl,
          cacheRoot,
        }),
        /must be owner\/name/,
      );
    }
  }));

test('a local install degrades a broken private source to the fallback', () =>
  withTempDir(async (cacheRoot) => {
    const { fetchImpl } = makeFetch({ status: 401 });
    const result = await resolveSourceOrFallback({
      env: { ONEKEY_PRIVATE_FONTS_TOKEN: 'expired' },
      lock: makeLock(),
      getGhToken: () => '',
      fetchImpl,
      cacheRoot,
    });
    assert.equal(result.source, 'fallback');
    assert.deepEqual(result.files, fallbackFiles);
  }));

test('a release build keeps a broken private source fatal', () =>
  withTempDir(async (cacheRoot) => {
    const { fetchImpl } = makeFetch({ status: 401 });
    await assert.rejects(
      resolveSourceOrFallback({
        env: {
          ONEKEY_PRIVATE_FONTS_TOKEN: 'expired',
          ONEKEY_REQUIRE_PRIVATE_FONTS: '1',
        },
        lock: makeLock(),
        getGhToken: () => '',
        fetchImpl,
        cacheRoot,
      }),
      /HTTP 401/,
    );
  }));

test('ONEKEY_PRIVATE_FONTS_DIR files must match the lock to count as private', () =>
  withTempDir(async (cacheRoot) => {
    const lock = makeLock();
    lock.files.bold = { ...lock.files.bold, sha256: '0'.repeat(64) };
    await assert.rejects(
      resolveSource({
        env: { ONEKEY_PRIVATE_FONTS_DIR: fallbackDir },
        lock,
        getGhToken: () => '',
        fetchImpl: makeFetch().fetchImpl,
        cacheRoot,
      }),
      /bold sha256 .* does not match brand\.lock\.json/,
    );
  }));

test('the committed Inter fallback never verifies as the private font', () => {
  assert.throws(
    () => verifyAgainstLock(fallbackFiles, readLock(), 'fallback'),
    /does not match brand\.lock\.json/,
  );
});
