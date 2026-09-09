const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ROOT,
  LOCALES_PATH,
  ENUM_PATH,
  loadCatalog,
  writeJson,
  fileHashes,
  memberKey,
} = require('./workflow-data');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-i18n-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const locales = loadCatalog(ROOT).locales;
  const old = Object.fromEntries(
    locales.map((locale) => [
      locale,
      { en_US: 'Existing message.', zh_CN: '已有消息。' }[locale] ||
        `Old ${locale}`,
    ]),
  );
  for (const locale of locales)
    writeJson(path.join(root, LOCALES_PATH, `${locale}.json`), {
      'global.existing': old[locale],
    });
  fs.mkdirSync(path.dirname(path.join(root, ENUM_PATH)), { recursive: true });
  fs.writeFileSync(
    path.join(root, ENUM_PATH),
    "export enum ETranslations {\n global_existing = 'global.existing',\n}\n",
  );
  fs.mkdirSync(path.join(root, 'module'));
  fs.writeFileSync(
    path.join(root, 'module/copy.ts'),
    "export const copy = {title: 'Travel Mode'};\n",
  );
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git(['init', '-b', 'codex/i18n-test']);
  git(['add', '.']);
  git([
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'test: fixture',
  ]);
  const translations = (en = 'Travel Mode', zh = '旅行模式') =>
    Object.fromEntries(
      locales.map((locale) => [
        locale,
        { en_US: en, zh_CN: zh }[locale] || `TRANSLATION_CANARY_${locale}`,
      ]),
    );
  const draft = (entries) => ({
    schemaVersion: 1,
    kind: 'i18n-draft',
    mode: 'update',
    locales,
    localeMap: {},
    sourceFiles: fileHashes(root, ['module/copy.ts']),
    unresolved: [],
    entries: entries || [
      {
        id: 'new',
        key: 'travel_mode__title',
        action: 'upsert',
        translations: translations(),
        sources: [],
      },
    ],
  });
  return { root, locales, old, translations, draft, git };
}

function fakeClient(context) {
  const keys = new Map();
  const writes = [];
  let id = 10;
  function makeKey(name, values) {
    const keyId = id;
    id += 1;
    const key = {
      key_id: keyId,
      key_name: { web: name },
      translations: context.locales.map((locale, index) => ({
        language_iso: locale,
        translation_id: keyId * 100 + index,
        translation: values[locale],
      })),
    };
    keys.set(name, key);
    return key;
  }
  makeKey('global.existing', context.old);
  const client = {
    projectId: 'project-test',
    project: async (name) => {
      if (name && name !== 'Monorepo test')
        throw new Error('Project name mismatch');
      return {
        id: client.projectId,
        name: 'Monorepo test',
        languages: context.locales.map((lang_iso) => ({ lang_iso })),
      };
    },
    findKey: async (name) => structuredClone(keys.get(name) || null),
    create: async (entry, localeMap) => {
      writes.push({
        method: 'POST',
        key: entry.key,
        locales: Object.keys(localeMap),
      });
      makeKey(entry.key, entry.translations);
    },
    request: async (method, suffix) => {
      if (method !== 'GET') throw new Error('Unexpected method');
      const record = [...keys.values()]
        .flatMap((key) => key.translations)
        .find(
          (item) => String(item.translation_id) === suffix.split('/').pop(),
        );
      return { data: { translation: structuredClone(record) } };
    },
    updateTranslation: async (recordId, value) => {
      const record = [...keys.values()]
        .flatMap((key) => key.translations)
        .find((item) => item.translation_id === recordId);
      writes.push({ method: 'PUT', id: recordId });
      record.translation = value;
    },
  };
  return { client, keys, writes, makeKey };
}

function fakePull(plan, root) {
  const catalog = loadCatalog(root);
  for (const locale of catalog.locales) {
    for (const entry of plan.entries)
      catalog.values[locale][entry.localKey] = entry.translations[locale];
    writeJson(
      path.join(root, LOCALES_PATH, `${locale}.json`),
      catalog.values[locale],
    );
  }
  fs.writeFileSync(
    path.join(root, ENUM_PATH),
    `export enum ETranslations {\n${Object.keys(catalog.values.en_US)
      .map((key) => ` ${memberKey(key)} = '${key}',`)
      .join('\n')}\n}\n`,
  );
}

module.exports = { fixture, fakeClient, fakePull };
