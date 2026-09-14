const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { applyPlan, verifyLocal } = require('./workflow-apply');
const { LOCALES_PATH, readJson, writeJson } = require('./workflow-data');
const {
  preparePlan,
  renderPreview,
  savePlan,
  readPlan,
} = require('./workflow-plan');
const { fixture, fakeClient, fakePull } = require('./workflow-test-fixture');

async function prepared(t, entries) {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const plan = await preparePlan({
    draft: ctx.draft(entries?.(ctx)),
    client: api.client,
    projectName: 'Monorepo test',
    root: ctx.root,
  });
  const file = path.join(ctx.root, 'plan.json');
  savePlan(plan, file);
  return {
    ...ctx,
    ...api,
    plan,
    file,
    apply: (overrides) =>
      applyPlan({
        file,
        approval: plan.approval,
        client: api.client,
        root: ctx.root,
        pullImpl: fakePull,
        ...overrides,
      }),
  };
}

test('preview reads only, contains bilingual before/after, and keeps all locale values in the plan', async (t) => {
  const ctx = await prepared(t, (item) => [
    {
      key: 'global.existing',
      action: 'upsert',
      translations: item.translations('Updated message', '更新后的消息'),
      sources: [],
    },
  ]);
  assert.equal(ctx.writes.length, 0);
  const markdown = renderPreview(ctx.plan);
  assert(markdown.includes('Existing message.'));
  assert(markdown.includes('Updated message'));
  assert(markdown.includes('更新后的消息'));
  assert(!markdown.includes('TRANSLATION_CANARY'));
  const rows = markdown.split('\n');
  const englishRow = rows.findIndex((row) =>
    row.startsWith('| global.existing |'),
  );
  assert(rows[englishRow].includes('Updated message'));
  assert(
    rows[englishRow + 1].startsWith('| | 原：已有消息。<br>新：更新后的消息 |'),
  );
  assert.throws(() => savePlan(ctx.plan, ctx.file), /already exists/);
  assert.equal(Object.keys(ctx.plan.entries[0].translations).length, 19);
  assert.throws(() => readPlan(ctx.file, 'not-confirmed'), /Approval/);
  const changed = readJson(ctx.file);
  changed.entries[0].translations.zh_CN = '偷偷修改';
  writeJson(ctx.file, changed);
  assert.throws(() => readPlan(ctx.file), /changed or are invalid/);
});

test('missing approval, wrong project and changed source block every write', async (t) => {
  const ctx = await prepared(t);
  await assert.rejects(
    () => ctx.apply({ approval: undefined }),
    /confirmation/,
  );
  ctx.client.projectId = 'another-project';
  await assert.rejects(() => ctx.apply(), /Credential project/);
  ctx.client.projectId = ctx.plan.project.id;
  fs.appendFileSync(path.join(ctx.root, 'module/copy.ts'), '// changed\n');
  await assert.rejects(() => ctx.apply(), /Source changed/);
  assert.equal(ctx.writes.length, 0);
});

test('reused generic keys preserve live remote translations instead of reverting to stale local copy', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  api.keys.get('global.existing').translations[0].translation =
    'Latest remote copy';
  const entry = {
    key: 'global.existing',
    action: 'upsert',
    translations: ctx.old,
    preserveRemoteLocales: ctx.locales,
    sources: [],
  };
  const plan = await preparePlan({
    draft: ctx.draft([entry]),
    client: api.client,
    projectName: 'Monorepo test',
    root: ctx.root,
  });
  assert.equal(plan.entries[0].translations.bn, 'Latest remote copy');
  assert.deepEqual(plan.entries[0].changedLocales, []);
});

test('generated local edits, remote edits and new-key collisions block upload', async (t) => {
  await t.test('local edits', async (sub) => {
    const ctx = await prepared(sub);
    fs.appendFileSync(path.join(ctx.root, LOCALES_PATH, 'en_US.json'), '\n');
    await assert.rejects(() => ctx.apply(), /local changes/);
    assert.equal(ctx.writes.length, 0);
  });
  await t.test('remote edits preflight the whole batch', async (sub) => {
    const ctx = await prepared(sub, (item) => [
      item.draft().entries[0],
      {
        key: 'global.existing',
        action: 'upsert',
        translations: item.translations(),
        sources: [],
      },
    ]);
    ctx.keys.get('global.existing').translations[0].translation =
      'Concurrent editor';
    await assert.rejects(() => ctx.apply(), /remote translation changed/);
    assert.equal(ctx.writes.length, 0);
  });
  await t.test('new key collision', async (sub) => {
    const ctx = await prepared(sub);
    ctx.makeKey('travel_mode__title', ctx.old);
    await assert.rejects(() => ctx.apply(), /different key now occupies/);
    assert.equal(ctx.writes.length, 0);
  });
});

test('mixed create/update uploads all locales, pulls, verifies, and reruns without writes', async (t) => {
  const ctx = await prepared(t, (item) => [
    item.draft().entries[0],
    {
      key: 'global.existing',
      action: 'upsert',
      translations: { ...item.old, zh_CN: '更新' },
      sources: [],
    },
  ]);
  const receipt = await ctx.apply();
  assert.equal(receipt.status, 'complete');
  assert.equal(ctx.writes.length, 2);
  assert.equal(
    ctx.writes.find((write) => write.method === 'POST').locales.length,
    19,
  );
  assert.equal(ctx.writes.filter((write) => write.method === 'PUT').length, 1);
  assert.equal(verifyLocal(ctx.plan, ctx.root).verifiedKeys, 2);
  await ctx.apply();
  assert.equal(ctx.writes.length, 2);
});

test('partial failures reconcile completed records and retain the operation receipt', async (t) => {
  const ctx = await prepared(t, (item) => [
    {
      key: 'global.existing',
      action: 'upsert',
      translations: { ...item.old, bn: 'নতুন', de: 'Neu' },
      sources: [],
    },
  ]);
  const update = ctx.client.updateTranslation;
  let calls = 0;
  ctx.client.updateTranslation = async (...args) => {
    calls += 1;
    if (calls === 2) throw new Error('Connection interrupted');
    return update(...args);
  };
  await assert.rejects(() => ctx.apply(), /Connection interrupted/);
  assert.equal(readJson(`${ctx.file}.receipt.json`).operations.length, 1);
  ctx.client.updateTranslation = update;
  const receipt = await ctx.apply();
  assert.equal(ctx.writes.length, 2);
  assert.equal(receipt.operations.length, 2);
  assert.equal(receipt.previousAttempts[0].status, 'failed');
});

test('an ambiguous create result is reconciled without a second POST', async (t) => {
  const ctx = await prepared(t);
  const create = ctx.client.create;
  ctx.client.create = async (...args) => {
    await create(...args);
    throw new Error('Response lost');
  };
  await assert.rejects(() => ctx.apply(), /Response lost/);
  await ctx.apply();
  assert.equal(ctx.writes.length, 1);
});

test('pull verification detects missing translations and reports unrelated imported updates', async (t) => {
  const ctx = await prepared(t);
  const receipt = await ctx.apply({
    pullImpl: (plan, root) => {
      fakePull(plan, root);
      const file = path.join(root, LOCALES_PATH, 'de.json');
      const values = readJson(file);
      values['global.existing'] = 'An unrelated translator edit';
      writeJson(file, values);
    },
  });
  assert.deepEqual(receipt.verification.unrelatedChanges, [
    { key: 'global.existing', locale: 'de' },
  ]);
  const file = path.join(ctx.root, LOCALES_PATH, 'bn.json');
  const values = readJson(file);
  delete values.travel_mode__title;
  writeJson(file, values);
  assert.throws(
    () => verifyLocal(ctx.plan, ctx.root),
    /Pulled output mismatch/,
  );
});
