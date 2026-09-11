const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { applyPlan } = require('./workflow-apply');
const {
  ENUM_PATH,
  LOCALES_PATH,
  ROOT,
  generatedHashes,
  loadCatalog,
  readJson,
  writeJson,
} = require('./workflow-data');
const { preparePlan, savePlan } = require('./workflow-plan');
const { scanModule } = require('./workflow-scan');
const { syncWorkspace, readSync } = require('./workflow-sync');
const { fixture, fakeClient, fakePull } = require('./workflow-test-fixture');

test('the real locale generator supports an isolated output root without touching workspace translations', (t) => {
  const ctx = fixture(t);
  const before = generatedHashes(ROOT);
  execFileSync(process.execPath, [
    path.join(ROOT, 'development/scripts/i18n/build-locale-json-map.js'),
    '--output-root',
    ctx.root,
  ]);
  assert(
    fs
      .readFileSync(
        path.join(ctx.root, 'packages/shared/src/locale/localeJsonMap.ts'),
        'utf8',
      )
      .includes("import enUS from './json/en_US.json'"),
  );
  assert.deepEqual(generatedHashes(ROOT), before);
  assert.equal(
    loadCatalog(ctx.root).values.en_US['global.existing'],
    ctx.old.en_US,
  );
});

test('the local generator removes repeated enum keys without changing canonical locale values', (t) => {
  const ctx = fixture(t);
  const enumPath = path.join(ctx.root, ENUM_PATH);
  fs.writeFileSync(
    enumPath,
    "export enum ETranslations {\n global_existing = 'global.existing',\n global_existing = 'global.existing',\n}\n",
  );
  const before = loadCatalog(ctx.root);
  const localeHashes = Object.fromEntries(
    Object.entries(generatedHashes(ctx.root)).filter(([file]) =>
      file.startsWith(`${LOCALES_PATH}/`),
    ),
  );
  execFileSync(process.execPath, [
    path.join(ROOT, 'development/scripts/i18n/build-locale-json-map.js'),
    '--output-root',
    ctx.root,
  ]);
  const members = [
    ...fs.readFileSync(enumPath, 'utf8').matchAll(/\s+(\w+) = '([^']+)',/g),
  ];
  assert.equal(members.length, before.members.size);
  assert.deepEqual(
    members.map(([, member, key]) => [member, key]),
    [...before.members],
  );
  assert.deepEqual(loadCatalog(ctx.root).values, before.values);
  const after = generatedHashes(ctx.root);
  for (const [file, hash] of Object.entries(localeHashes))
    assert.equal(after[file], hash);
});

async function start(ctx, api, overrides = {}) {
  const file = path.join(ctx.root, 'sync.json');
  return syncWorkspace({
    file,
    root: ctx.root,
    projectName: 'Monorepo test',
    client: api.client,
    pullImpl: (_sync, root) => {
      const values = Object.fromEntries(
        api.keys
          .get('global.existing')
          .translations.map((record) => [
            record.language_iso,
            record.translation,
          ]),
      );
      fakePull(
        { entries: [{ localKey: 'global.existing', translations: values }] },
        root,
      );
    },
    ...overrides,
  });
}

test('initial pull precedes scan and its known generated diff remains usable through apply', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  api.keys.get('global.existing').translations[0].translation =
    'Fresh remote baseline';
  const sync = await start(ctx, api);
  assert.equal(api.writes.length, 0);
  assert.deepEqual(sync.changes, [{ key: 'global.existing', locale: 'bn' }]);
  assert.equal(
    readSync(path.join(ctx.root, 'sync.json'), ctx.root).status,
    'complete',
  );
  fs.writeFileSync(
    path.join(ctx.root, 'module/copy.ts'),
    'const label = ETranslations.global_existing;',
  );
  const draft = scanModule({
    modules: ['module'],
    root: ctx.root,
    includeComplete: true,
    mode: 'update',
  });
  draft.sync = sync;
  assert.equal(draft.entries[0].translations.bn, 'Fresh remote baseline');
  draft.entries[0].translations.zh_CN = '新的中文';
  const plan = await preparePlan({
    draft,
    client: api.client,
    projectName: 'Monorepo test',
    root: ctx.root,
  });
  assert.deepEqual(plan.entries[0].changedLocales, ['zh_CN']);
  const file = path.join(ctx.root, 'plan.json');
  savePlan(plan, file);
  const result = await applyPlan({
    file,
    approval: plan.approval,
    client: api.client,
    root: ctx.root,
    pullImpl: fakePull,
  });
  assert.equal(result.status, 'complete');
  assert.equal(api.writes.length, 1);
  assert.equal(
    loadCatalog(ctx.root).values.bn['global.existing'],
    'Fresh remote baseline',
  );
});

test('remote changes between initial pull and preview cannot be proposed as stale overwrites', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const sync = await start(ctx, api);
  api.keys.get('global.existing').translations[0].translation =
    'Edited after initial pull';
  const draft = {
    ...ctx.draft([
      {
        key: 'global.existing',
        action: 'upsert',
        translations: ctx.old,
        sources: [],
      },
    ]),
    sync,
  };
  await assert.rejects(
    () =>
      preparePlan({
        draft,
        client: api.client,
        projectName: 'Monorepo test',
        root: ctx.root,
      }),
    /changed since initial pull/,
  );
  assert.equal(api.writes.length, 0);
});

test('initial pull refuses a wrong project or local edits before invoking the generator', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  let pulls = 0;
  const pullImpl = async () => {
    pulls += 1;
  };
  await assert.rejects(
    () => start(ctx, api, { projectName: 'Wrong project', pullImpl }),
    /Project name mismatch/,
  );
  fs.appendFileSync(path.join(ctx.root, LOCALES_PATH, 'en_US.json'), '\n');
  await assert.rejects(() => start(ctx, api, { pullImpl }), /local changes/);
  assert.equal(pulls, 0);
});

test('local edits during project verification are not overwritten by initial pull', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const project = api.client.project;
  api.client.project = async (name) => {
    const value = await project(name);
    fs.appendFileSync(path.join(ctx.root, LOCALES_PATH, 'en_US.json'), '\n');
    return value;
  };
  await assert.rejects(
    () => start(ctx, api, { pullImpl: () => assert.fail('Must not pull') }),
    /local changes/,
  );
});

test('later generated edits, extra files and modified sync records invalidate the baseline', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  await start(ctx, api);
  const file = path.join(ctx.root, 'sync.json');
  const extra = path.join(ctx.root, LOCALES_PATH, 'notes.txt');
  fs.writeFileSync(extra, 'Local work');
  assert.throws(() => readSync(file, ctx.root), /file set changed/);
  fs.unlinkSync(extra);
  const original = readJson(file);
  writeJson(file, { ...original, project: { id: 'Other project' } });
  assert.throws(() => readSync(file, ctx.root), /Invalid/);
  writeJson(file, original);
  fs.appendFileSync(path.join(ctx.root, LOCALES_PATH, 'en_US.json'), '\n');
  assert.throws(
    () => readSync(file, ctx.root),
    /Generated files since initial pull changed/,
  );
});

test('a failed pull never produces a usable sync record', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  await assert.rejects(
    () =>
      start(ctx, api, {
        pullImpl: async () => {
          throw new Error('Generator failed');
        },
      }),
    /Generator failed/,
  );
  const file = path.join(ctx.root, 'sync.json');
  assert.equal(readJson(file).status, 'failed');
  assert.throws(() => readSync(file, ctx.root), /Invalid or incomplete/);
});

test('refresh accepts only the unchanged previous pull and retains imported change tracking', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  api.keys.get('global.existing').translations[0].translation = 'Fresh Bengali';
  const previousSync = await start(ctx, api);
  api.keys.get('global.existing').translations[1].translation = 'Fresh German';
  const file = path.join(ctx.root, 'sync-refreshed.json');
  const refreshed = await start(ctx, api, { file, previousSync });
  assert.equal(refreshed.previousSyncChecksum, previousSync.checksum);
  assert.deepEqual(refreshed.changes, [
    { key: 'global.existing', locale: 'bn' },
    { key: 'global.existing', locale: 'de' },
  ]);
  assert.equal(readSync(file, ctx.root).status, 'complete');
});

test('verified recovery establishes a baseline only when a staged pull exactly matches all current generated files', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  api.keys.get('global.existing').translations[0].translation =
    'Previously pulled Bengali';
  await start(ctx, api);
  const hashes = generatedHashes(ctx.root);
  const remoteFiles = Object.fromEntries(
    Object.keys(hashes).map((file) => [
      file,
      fs.readFileSync(path.join(ctx.root, file)),
    ]),
  );
  const pullImpl = (_sync, root, outputRoot) => {
    assert.notEqual(outputRoot, root);
    for (const [name, content] of Object.entries(remoteFiles)) {
      const target = path.join(outputRoot, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  };
  const file = path.join(ctx.root, 'sync-recovered.json');
  const sync = await start(ctx, api, { file, verifyCurrent: true, pullImpl });
  assert(sync.verificationDirectory);
  assert.equal(readSync(file, ctx.root).status, 'complete');
  assert.deepEqual(generatedHashes(ctx.root), hashes);
  assert.equal(api.writes.length, 0);

  fs.appendFileSync(path.join(ctx.root, LOCALES_PATH, 'en_US.json'), '\n');
  const edited = generatedHashes(ctx.root);
  await assert.rejects(
    () =>
      start(ctx, api, {
        file: path.join(ctx.root, 'sync-conflict.json'),
        verifyCurrent: true,
        pullImpl,
      }),
    /Fresh pull differs/,
  );
  assert.deepEqual(generatedHashes(ctx.root), edited);
  assert.equal(
    readJson(path.join(ctx.root, 'sync-conflict.json')).status,
    'failed',
  );
});

test('verified recovery rejects changes made during the staged pull and never accepts a failed generator', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const localFile = path.join(ctx.root, LOCALES_PATH, 'en_US.json');
  await assert.rejects(
    () =>
      start(ctx, api, {
        file: path.join(ctx.root, 'sync-race.json'),
        verifyCurrent: true,
        pullImpl: () => {
          fs.appendFileSync(localFile, '\n');
        },
      }),
    /during verified pull changed/,
  );
  const current = fs.readFileSync(localFile, 'utf8');
  await assert.rejects(
    () =>
      start(ctx, api, {
        file: path.join(ctx.root, 'sync-broken.json'),
        verifyCurrent: true,
        pullImpl: () => {
          throw new Error('Generator failed');
        },
      }),
    /Generator failed/,
  );
  assert.equal(fs.readFileSync(localFile, 'utf8'), current);
  assert.throws(
    () => readSync(path.join(ctx.root, 'sync-broken.json'), ctx.root),
    /incomplete/,
  );
});
