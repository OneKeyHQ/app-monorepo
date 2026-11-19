const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  prepareMMKVSource,
  sha256,
  sourceTreeDigest,
} = require('./prepare-mmkv-source');

function fixture(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmkv-source-test-'));
  t.after(() => fs.rmSync(rootDir, { recursive: true }));
  const commit = 'a'.repeat(40);
  const source = path.join(rootDir, `MMKV-${commit}`);
  for (const file of [
    'Core/value.txt',
    'Core/MMKV.h',
    'Core/MMKVPredef.h',
    'Core/MMBuffer.h',
    'Core/MiniPBCoder.h',
    'Core/MMKVHandler.h',
    'Core/MemoryFile.h',
    'Core/MMKVLog.h',
    'Android/MMKV/mmkv/proguard-rules.pro',
    'iOS/MMKV/MMKV/API.h',
    'MMKV.podspec',
    'MMKVCore.podspec',
    'LICENSE.TXT',
  ]) {
    const fullPath = path.join(source, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, 'before\n');
  }
  const patchedFile = path.join(source, 'Core/value.txt');
  fs.writeFileSync(patchedFile, 'after\n');
  const treeSha256 = sourceTreeDigest(source);
  fs.writeFileSync(patchedFile, 'before\n');
  const archiveFile = path.join(rootDir, 'source.tar.gz');
  execFileSync('tar', ['-czf', archiveFile, '-C', rootDir, `MMKV-${commit}`]);
  const archive = fs.readFileSync(archiveFile);
  const spec = path.join(rootDir, 'apps/mobile/native/mmkv');
  fs.mkdirSync(spec, { recursive: true });
  const lock = {
    schemaVersion: 1,
    repository: 'https://github.com/margelo/MMKV',
    commit,
    archive: `https://codeload.github.com/margelo/MMKV/tar.gz/${commit}`,
    sha256: sha256(archive),
    treeSha256,
  };
  fs.writeFileSync(path.join(spec, 'source.lock.json'), JSON.stringify(lock));
  fs.writeFileSync(
    path.join(spec, 'checked-sync.patch'),
    [
      'diff --git a/Core/value.txt b/Core/value.txt',
      '--- a/Core/value.txt',
      '+++ b/Core/value.txt',
      '@@ -1 +1 @@',
      '-before',
      '+after',
      '',
    ].join('\n'),
  );
  return { rootDir, archive, spec };
}

test('prepares pinned source and reuses verified source without a network call', async (t) => {
  const { rootDir, archive } = fixture(t);
  const prepared = await prepareMMKVSource({
    rootDir,
    readArchive: async () => archive,
  });
  assert.equal(
    fs.readFileSync(path.join(prepared, 'Core/value.txt'), 'utf8'),
    'after\n',
  );
  assert.equal(
    await prepareMMKVSource({
      rootDir,
      readArchive: () => assert.fail('a verified cache must not download'),
    }),
    prepared,
  );
});

test('rejects a wrong archive before extraction or patch execution', async (t) => {
  const { rootDir } = fixture(t);
  await assert.rejects(
    prepareMMKVSource({
      rootDir,
      readArchive: async () => Buffer.from('wrong archive'),
    }),
    /archive SHA256 mismatch/u,
  );
});

test('rejects a poisoned prepared cache even if its receipt is also changed', async (t) => {
  const { rootDir, archive } = fixture(t);
  const prepared = await prepareMMKVSource({
    rootDir,
    readArchive: async () => archive,
  });
  fs.writeFileSync(path.join(prepared, 'Core/value.txt'), 'poisoned\n');
  const receiptPath = path.join(prepared, 'onekey-source.json');
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  receipt.files['Core/value.txt'] = sha256('poisoned\n');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  await assert.rejects(
    prepareMMKVSource({ rootDir }),
    /source tree SHA256 mismatch/u,
  );
});

test('rejects an inapplicable patch without substituting the unchecked binary', async (t) => {
  const { rootDir, archive, spec } = fixture(t);
  const patch = path.join(spec, 'checked-sync.patch');
  fs.writeFileSync(
    patch,
    fs.readFileSync(patch, 'utf8').replace('-before', '-another-base'),
  );
  await assert.rejects(
    prepareMMKVSource({ rootDir, readArchive: async () => archive }),
    /git failed/u,
  );
});

test('rejects extra, changed, missing or symlinked generated headers', async (t) => {
  const mutations = {
    'shadow standard header': (include) =>
      fs.writeFileSync(path.join(include, 'string'), 'poisoned'),
    'extra exported header': (include) =>
      fs.writeFileSync(path.join(include, 'MMKV/extra.h'), 'poisoned'),
    'changed header': (include) =>
      fs.writeFileSync(path.join(include, 'MMKV/MMKV.h'), 'poisoned'),
    'missing header': (include) =>
      fs.unlinkSync(path.join(include, 'MMKV/MMKV.h')),
    'symlink header': (include) => {
      const header = path.join(include, 'MMKV/MMKV.h');
      fs.unlinkSync(header);
      fs.symlinkSync('../../MMKV.h', header);
    },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    await t.test(name, async (testContext) => {
      const { rootDir, archive } = fixture(testContext);
      const prepared = await prepareMMKVSource({
        rootDir,
        readArchive: async () => archive,
      });
      mutate(path.join(prepared, 'Core/include'));
      await assert.rejects(
        prepareMMKVSource({ rootDir }),
        /generated header|SHA256 mismatch/u,
      );
    });
  }
});

test('concurrent preparations accept only the same verified result', async (t) => {
  const { rootDir, archive } = fixture(t);
  const prepare = () =>
    prepareMMKVSource({ rootDir, readArchive: async () => archive });
  const [first, second] = await Promise.all([prepare(), prepare()]);
  assert.equal(first, second);
  assert.equal(
    fs.readFileSync(path.join(first, 'Core/value.txt'), 'utf8'),
    'after\n',
  );
});
