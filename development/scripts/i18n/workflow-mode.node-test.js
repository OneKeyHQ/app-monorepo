const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const { run, runAdd } = require('./i18n-workflow');
const { applyPlan } = require('./workflow-apply');
const { digest, writeJson } = require('./workflow-data');
const { singleDraft } = require('./workflow-draft');
const {
  preparePlan,
  readPlan,
  renderPreview,
  savePlan,
} = require('./workflow-plan');
const { scanModule } = require('./workflow-scan');
const { fixture, fakeClient, fakePull } = require('./workflow-test-fixture');

async function prepare(ctx, api, draft) {
  const plan = await preparePlan({
    draft,
    client: api.client,
    projectName: 'Monorepo test',
    root: ctx.root,
  });
  const file = path.join(ctx.root, 'plan.json');
  savePlan(plan, file);
  return {
    plan,
    file,
    apply: () =>
      applyPlan({
        file,
        approval: plan.approval,
        client: api.client,
        root: ctx.root,
        pullImpl: fakePull,
      }),
  };
}

test('default completion creates new keys and reuses existing translations without writes to them', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const draft = singleDraft('travel_mode__title', ctx.translations(), ctx.root);
  draft.entries.push({
    key: 'global.existing',
    action: 'upsert',
    translations: ctx.old,
    sources: [],
  });
  const prepared = await prepare(ctx, api, draft);
  assert.equal(prepared.plan.mode, 'complete');
  assert.match(renderPreview(prepared.plan), /模式：补全/);
  await prepared.apply();
  assert.deepEqual(
    api.writes.map((write) => write.method),
    ['POST'],
  );
  assert.deepEqual(
    prepared.plan.entries.find((entry) => entry.key === 'global.existing')
      .changedLocales,
    [],
  );
});

for (const mode of ['complete', 'update']) {
  test(`${mode} fills only missing language values on an existing key`, async (t) => {
    const ctx = fixture(t);
    const api = fakeClient(ctx);
    const records = api.keys.get('global.existing').translations;
    records.find((record) => record.language_iso === 'zh_CN').translation = '';
    records.find((record) => record.language_iso === 'de').translation = '  \n';
    const preserved = records.filter((record) => record.translation.trim());
    const before = structuredClone(preserved);
    const prepared = await prepare(
      ctx,
      api,
      singleDraft('global.existing', ctx.old, ctx.root, mode),
    );
    assert.deepEqual(prepared.plan.entries[0].changedLocales, ['de', 'zh_CN']);
    await prepared.apply();
    assert.deepEqual(
      api.writes.map((write) => write.method),
      ['PUT', 'PUT'],
    );
    assert.deepEqual(preserved, before);
    assert(
      records.every(
        (record) => record.translation === ctx.old[record.language_iso],
      ),
    );
    await prepared.apply();
    assert.equal(api.writes.length, 2);
  });
}

test('completion rejects non-empty overwrites but update allows existing changes and new keys', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const draft = singleDraft(
    'global.existing',
    { ...ctx.old, zh_CN: '更新后的消息。' },
    ctx.root,
  );
  await assert.rejects(
    () => prepare(ctx, api, draft),
    /complete mode cannot overwrite/,
  );
  assert.equal(api.writes.length, 0);
  draft.mode = 'update';
  draft.entries.push(ctx.draft().entries[0]);
  const prepared = await prepare(ctx, api, draft);
  assert.match(renderPreview(prepared.plan), /模式：更新/);
  await prepared.apply();
  assert.deepEqual(
    api.writes.map((write) => write.method),
    ['PUT', 'POST'],
  );
});

for (const stage of ['before apply', 'immediate read']) {
  test(`completion stops when another translator fills the blank ${stage}`, async (t) => {
    const ctx = fixture(t);
    const api = fakeClient(ctx);
    const record = api.keys
      .get('global.existing')
      .translations.find((item) => item.language_iso === 'zh_CN');
    record.translation = '';
    const prepared = await prepare(
      ctx,
      api,
      singleDraft('global.existing', ctx.old, ctx.root),
    );
    if (stage === 'before apply') {
      record.translation = 'Another translator';
    } else {
      const request = api.client.request;
      api.client.request = async (...args) => {
        record.translation = 'Another translator';
        return request(...args);
      };
    }
    await assert.rejects(
      prepared.apply,
      /remote translation changed|concurrent translation update/,
    );
    assert.equal(api.writes.length, 0);
    assert.equal(record.translation, 'Another translator');
  });
}

test('mode is bound to approval; invalid and legacy plans and apply overrides stop before writes', async (t) => {
  const ctx = fixture(t);
  const api = fakeClient(ctx);
  const prepared = await prepare(
    ctx,
    api,
    singleDraft(
      'global.existing',
      { ...ctx.old, zh_CN: '更新' },
      ctx.root,
      'update',
    ),
  );
  const { approval, ...content } = prepared.plan;
  const switched = { ...content, mode: 'complete' };
  assert.notEqual(digest(switched), approval);
  writeJson(prepared.file, { ...switched, approval });
  assert.throws(() => readPlan(prepared.file), /changed or are invalid/);
  writeJson(prepared.file, { ...switched, approval: digest(switched) });
  await assert.rejects(
    () =>
      applyPlan({
        file: prepared.file,
        approval: digest(switched),
        client: api.client,
        root: ctx.root,
        pullImpl: fakePull,
      }),
    /complete mode cannot overwrite/,
  );
  delete switched.mode;
  writeJson(prepared.file, { ...switched, approval: digest(switched) });
  assert.throws(() => readPlan(prepared.file), /no operation mode/);
  await assert.rejects(
    () => run(['apply', '--file', prepared.file, '--mode', 'update']),
    /confirmed plan mode/,
  );
  await assert.rejects(
    () => runAdd(['--apply', prepared.file, '--mode', 'update']),
    /cannot override/,
  );
  assert.throws(
    () =>
      singleDraft(
        'travel_mode__title',
        ctx.translations(),
        ctx.root,
        'invalid',
      ),
    /Mode must be/,
  );
  assert.throws(
    () =>
      scanModule({
        modules: ['module'],
        root: ctx.root,
        includeComplete: true,
      }),
    /requires --mode update/,
  );
  assert.equal(api.writes.length, 0);
});
