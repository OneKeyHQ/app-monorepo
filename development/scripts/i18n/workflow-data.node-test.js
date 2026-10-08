const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const {
  validateTranslations,
  mapLanguages,
  normalizeDraft,
  loadCatalog,
  writeJson,
  LOCALES_PATH,
} = require('./workflow-data');
const { fillDraft, singleDraft } = require('./workflow-draft');
const { scanModule } = require('./workflow-scan');
const { fixture } = require('./workflow-test-fixture');

test('full locale coverage and nested ICU/rich-text contracts are validated', (t) => {
  const ctx = fixture(t);
  const messages = ctx.translations(
    '{count, plural, one {<b>{name}</b>} other {<b>{name}</b> has # items}}',
    '{count, plural, other {<b>{name}</b>有 # 项}}',
  );
  for (const locale of ctx.locales)
    if (!['en_US', 'zh_CN'].includes(locale)) messages[locale] = messages.en_US;
  assert.doesNotThrow(() =>
    validateTranslations('test', messages, ctx.locales),
  );
  assert.throws(
    () => validateTranslations('test', { ...messages, bn: '' }, ctx.locales),
    /missing locales/,
  );
  assert.throws(
    () =>
      validateTranslations('test', { ...messages, typo: 'hi' }, ctx.locales),
    /unknown locales/,
  );
  assert.throws(
    () =>
      validateTranslations('test', { ...messages, bn: '{count}' }, ctx.locales),
    /variables or rich-text/,
  );
  assert.throws(
    () =>
      validateTranslations(
        'test',
        { ...messages, bn: '{count, plural,' },
        ctx.locales,
      ),
    /invalid ICU/,
  );
});

test('locale mapping permits format normalization and explicit regional mappings only', () => {
  assert.deepEqual(
    mapLanguages(
      ['en_US', 'zh_CN'],
      [{ lang_iso: 'en-us' }, { lang_iso: 'zh' }],
      { zh_CN: 'zh' },
    ),
    { en_US: 'en-us', zh_CN: 'zh' },
  );
  assert.throws(
    () => mapLanguages(['pt_BR'], [{ lang_iso: 'pt' }]),
    /No unique/,
  );
  assert.throws(
    () => mapLanguages(['pt', 'pt_BR'], [{ lang_iso: 'pt' }], { pt_BR: 'pt' }),
    /collapse/,
  );
  assert.throws(
    () =>
      mapLanguages(['en_US'], [{ lang_iso: 'en_US' }, { lang_iso: 'en-us' }]),
    /No unique/,
  );
});

test('scanner handles copy objects, arrays, JSX, aliases and dynamic expressions', (t) => {
  const ctx = fixture(t);
  fs.writeFileSync(
    path.join(ctx.root, 'module/view.tsx'),
    `
import { ETranslations as T } from '@onekeyhq/shared/src/locale';
import { helper } from './outside';
const text = { enableConfirmationDescription: 'Wallets remain hidden.', enableConfirmationDetails: ['Activity stays hidden.'], onConfirmText: 'Continue' };
console.log('Do not translate this log');
const id = T['global_existing'];
const dynamic = T[key];
const element = <Text testID="Do not translate ID" title="Hello">Visible text{'Yes'}{\`Hello \${name}\`}</Text>;
`,
  );
  fs.writeFileSync(
    path.join(ctx.root, 'module/copy.test.ts'),
    "throw new Error('Ignored test message');",
  );
  const result = scanModule({ modules: ['module'], root: ctx.root });
  assert.equal(result.summary.files, 2);
  assert.equal(result.references[0].key, 'global.existing');
  assert.equal(
    result.entries.find((entry) => entry.text === 'Wallets remain hidden.')
      .role,
    'desc',
  );
  assert.equal(
    result.entries.find((entry) => entry.text === 'Activity stays hidden.')
      .role,
    'desc',
  );
  assert.equal(
    result.entries.find((entry) => entry.text === 'Continue').role,
    'action',
  );
  assert(result.entries.some((entry) => entry.text === 'Yes'));
  assert(
    !result.entries.some((entry) => /Do not|Ignored test/.test(entry.text)),
  );
  assert.equal(result.unresolved.length, 2);
  assert(result.dependencies.some((item) => item.endsWith('./outside')));
  assert.throws(
    () => scanModule({ modules: ['../'], root: ctx.root }),
    /inside/,
  );
  fs.symlinkSync(path.join(ctx.root, 'module'), path.join(ctx.root, 'linked'));
  assert.throws(
    () => scanModule({ modules: ['linked'], root: ctx.root }),
    /symlink/,
  );
});

test('incomplete references have stable ids and fill reuses the complete local key', (t) => {
  const ctx = fixture(t);
  writeJson(path.join(ctx.root, LOCALES_PATH, 'bn.json'), {});
  fs.writeFileSync(
    path.join(ctx.root, 'module/copy.ts'),
    'const label = ETranslations.global_existing;',
  );
  const draft = scanModule({ modules: ['module'], root: ctx.root });
  assert.equal(draft.entries.length, 1);
  assert(draft.entries[0].id);
  const file = path.join(ctx.root, 'draft.json');
  const patch = path.join(ctx.root, 'patch.json');
  writeJson(file, draft);
  writeJson(patch, {
    entries: [
      {
        id: draft.entries[0].id,
        reuse: 'global.existing',
        translations: { bn: 'বার্তা' },
        action: 'upsert',
      },
    ],
  });
  fillDraft(file, patch, ctx.root);
  const updated = JSON.parse(fs.readFileSync(file));
  assert.equal(updated.entries[0].translations.en_US, ctx.old.en_US);
  assert.doesNotThrow(() => normalizeDraft(updated, loadCatalog(ctx.root)));
});

test('draft review rejects undecided candidates, conflicting keys and enum collisions', (t) => {
  const ctx = fixture(t);
  const catalog = loadCatalog(ctx.root);
  const entry = ctx.draft().entries[0];
  assert.throws(
    () => normalizeDraft(ctx.draft([{ ...entry, action: 'review' }]), catalog),
    /Review candidate/,
  );
  assert.throws(
    () =>
      normalizeDraft(
        ctx.draft([{ ...entry, key: 'global_existing' }]),
        catalog,
      ),
    /collision/,
  );
  assert.throws(
    () =>
      normalizeDraft(
        ctx.draft([
          entry,
          { ...entry, translations: ctx.translations('Different') },
        ]),
        catalog,
      ),
    /Conflicting/,
  );
  assert.throws(
    () => normalizeDraft({ ...ctx.draft(), unresolved: ['dynamic'] }, catalog),
    /unresolved/,
  );
  const single = singleDraft(
    'global.existing',
    { en_US: 'Updated', zh_CN: '更新' },
    ctx.root,
  );
  assert.equal(
    Object.keys(single.entries[0].translations).length,
    ctx.locales.length,
  );
  assert.throws(() => normalizeDraft(single, catalog), /missing locales/);
});

test('table fill binds columns to candidate ids and rejects shifted or duplicate values without editing the draft', (t) => {
  const ctx = fixture(t);
  const file = path.join(ctx.root, 'draft.json');
  const patchFile = path.join(ctx.root, 'patch.json');
  const draft = ctx.draft();
  writeJson(file, draft);
  const patch = {
    entries: [{ id: 'new', action: 'upsert' }],
    table: { ids: ['new'], columns: { zh_CN: ['旅行模式'] } },
  };
  writeJson(patchFile, patch);
  fillDraft(file, patchFile, ctx.root);
  const original = fs.readFileSync(file, 'utf8');
  for (const table of [
    { ids: ['new'], columns: { zh_CN: ['First', 'Extra row'] } },
    { ids: ['new', 'new'], columns: { zh_CN: ['First', 'Duplicate'] } },
    { ids: ['wrong-id'], columns: { zh_CN: ['Wrong candidate'] } },
    { ids: ['new'], columns: { unknown: ['Unknown locale'] } },
  ]) {
    writeJson(patchFile, { ...patch, table });
    assert.throws(() => fillDraft(file, patchFile, ctx.root), /table|Table/);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }
});
