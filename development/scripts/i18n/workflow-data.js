const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { parse, TYPE } = require('@formatjs/icu-messageformat-parser');
const { stableStringify } = require('fast-safe-stringify');

const enumKey = require('./transform-translation-enum-key');

const ROOT = path.resolve(__dirname, '../../..');
const LOCALES_PATH = 'packages/shared/src/locale/json';
const ENUM_PATH = 'packages/shared/src/locale/enum/translations.ts';
const GENERATED_PATHS = [
  LOCALES_PATH,
  ENUM_PATH,
  'packages/shared/src/locale/localeJsonMap.ts',
];

function workflowMode(mode = 'complete') {
  if (!['complete', 'update'].includes(mode))
    throw new Error(
      'Mode must be complete (fill missing keys/translations) or update (upsert).',
    );
  return mode;
}

function digest(value) {
  return createHash('sha256')
    .update(
      typeof value === 'string' || Buffer.isBuffer(value)
        ? value
        : stableStringify(value),
    )
    .digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function localKey(key) {
  return key.replaceAll('::', '.');
}

function memberKey(key) {
  return enumKey(localKey(key).split('.'));
}

function loadCatalog(root = ROOT) {
  const locales = fs
    .readdirSync(path.join(root, LOCALES_PATH))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5))
    .toSorted();
  if (!locales.includes('en_US') || !locales.includes('zh_CN'))
    throw new Error('Repository must contain en_US and zh_CN locales.');
  const values = Object.fromEntries(
    locales.map((locale) => [
      locale,
      readJson(path.join(root, LOCALES_PATH, `${locale}.json`)),
    ]),
  );
  const members = new Map();
  for (const key of Object.keys(values.en_US)) {
    const member = memberKey(key);
    if (members.has(member) && members.get(member) !== key)
      throw new Error(
        `Generated enum collision: ${key} / ${members.get(member)}`,
      );
    members.set(member, key);
  }
  return { locales, values, members };
}

function fileHashes(root, files) {
  return Object.fromEntries(
    [...new Set(files)]
      .toSorted()
      .map((file) => [file, digest(fs.readFileSync(path.join(root, file)))]),
  );
}

function generatedHashes(root = ROOT) {
  return fileHashes(
    root,
    [
      ...fs
        .readdirSync(path.join(root, LOCALES_PATH))
        .map((name) => `${LOCALES_PATH}/${name}`),
      ...GENERATED_PATHS.slice(1),
    ].filter((file) => fs.existsSync(path.join(root, file))),
  );
}

function assertHashes(root, hashes, label) {
  for (const [file, hash] of Object.entries(hashes)) {
    const full = path.resolve(root, file);
    if (
      !full.startsWith(`${root}${path.sep}`) ||
      !fs.existsSync(full) ||
      digest(fs.readFileSync(full)) !== hash
    ) {
      throw new Error(`${label} changed: ${file}. Regenerate the preview.`);
    }
  }
}

function messageSignature(text) {
  const variables = new Set();
  const tags = new Set();
  function visit(nodes) {
    for (const node of nodes) {
      if (
        [
          TYPE.argument,
          TYPE.number,
          TYPE.date,
          TYPE.time,
          TYPE.select,
          TYPE.plural,
        ].includes(node.type)
      )
        variables.add(node.value);
      if (node.type === TYPE.tag) {
        tags.add(node.value);
        visit(node.children);
      }
      if (node.options)
        Object.values(node.options).forEach((option) => visit(option.value));
    }
  }
  visit(parse(text));
  return { variables: [...variables].toSorted(), tags: [...tags].toSorted() };
}

function validateTranslations(key, translations, locales) {
  if (
    !translations ||
    typeof translations !== 'object' ||
    Array.isArray(translations)
  )
    throw new Error(`${key}: translations must be a locale-to-text object.`);
  const missing = locales.filter(
    (locale) =>
      typeof translations[locale] !== 'string' || !translations[locale].trim(),
  );
  const extra = Object.keys(translations).filter(
    (locale) => !locales.includes(locale),
  );
  if (missing.length || extra.length)
    throw new Error(
      `${key}: missing locales [${missing.join(', ')}]; unknown locales [${extra.join(', ')}].`,
    );
  let expected;
  for (const locale of [
    'en_US',
    ...locales.filter((item) => item !== 'en_US'),
  ]) {
    let signature;
    try {
      signature = messageSignature(translations[locale]);
    } catch (error) {
      throw new Error(
        `${key}/${locale}: invalid ICU message: ${error.message}`,
        { cause: error },
      );
    }
    expected ??= signature;
    if (stableStringify(signature) !== stableStringify(expected))
      throw new Error(
        `${key}/${locale}: ICU variables or rich-text tags differ from en_US.`,
      );
  }
}

function normalizeDraft(draft, catalog) {
  if (
    draft.schemaVersion !== 1 ||
    draft.kind !== 'i18n-draft' ||
    !Array.isArray(draft.entries)
  )
    throw new Error('Expected an i18n-draft with schemaVersion 1 and entries.');
  if (stableStringify(draft.locales) !== stableStringify(catalog.locales))
    throw new Error('Repository locale set changed; rescan the module.');
  if (draft.review?.requiresRefresh)
    throw new Error(
      'This review follows an applied plan. Refresh sync/scan and re-import with --baseline before preview.',
    );
  const commented = draft.entries.filter(
    (entry) =>
      entry.reviewNote ||
      Object.keys(entry.translationReviewNotes || {}).length,
  );
  if (
    commented.length &&
    (!draft.reviewNotesReviewed ||
      commented.some((entry) => !entry.reviewResponse?.trim()))
  )
    throw new Error(
      'Resolve review comments, write reviewResponse for each commented entry, and set reviewNotesReviewed before preview.',
    );
  if (draft.unresolved?.length && !draft.unresolvedReviewed)
    throw new Error(
      'Review unresolved/dynamic references and set unresolvedReviewed before preview.',
    );
  const entries = new Map();
  const members = new Map(catalog.members);
  if (
    draft.entries.some(
      (entry) => entry.action === 'ignore' && !entry.reason?.trim(),
    )
  )
    throw new Error('Ignored candidates require a reason.');
  for (const entry of draft.entries.filter(
    (item) => item.action !== 'ignore',
  )) {
    if (entry.action !== 'upsert')
      throw new Error(
        `Review candidate ${entry.key || entry.id}: choose upsert or ignore.`,
      );
    if (
      typeof entry.key !== 'string' ||
      !entry.key.trim() ||
      /[\n\r,]/.test(entry.key)
    )
      throw new Error('Each entry requires an exact key name.');
    const key = localKey(entry.key);
    const member = memberKey(key);
    if (members.has(member) && members.get(member) !== key)
      throw new Error(`Enum collision: ${key} / ${members.get(member)}`);
    members.set(member, key);
    validateTranslations(key, entry.translations, catalog.locales);
    const preserveRemoteLocales = entry.preserveRemoteLocales || [];
    if (
      !Array.isArray(preserveRemoteLocales) ||
      preserveRemoteLocales.some((locale) => !catalog.locales.includes(locale))
    )
      throw new Error(`${key}: invalid preserved locale set.`);
    const existing = entries.get(key);
    if (
      existing &&
      stableStringify(existing.translations) !==
        stableStringify(entry.translations)
    )
      throw new Error(`Conflicting translations for ${key}.`);
    if (
      existing &&
      digest(existing.preserveRemoteLocales) !== digest(preserveRemoteLocales)
    )
      throw new Error(`Conflicting reuse decisions for ${key}.`);
    entries.set(key, {
      key: entry.key,
      localKey: key,
      enumMember: member,
      translations: entry.translations,
      preserveRemoteLocales,
      ...(entry.reviewResponse ? { reviewResponse: entry.reviewResponse } : {}),
      sources: [...(existing?.sources || []), ...(entry.sources || [])],
    });
  }
  if (!entries.size) throw new Error('No reviewed translations to publish.');
  return [...entries.values()].toSorted((a, b) => a.key.localeCompare(b.key));
}

function mapLanguages(locales, languages, overrides = {}) {
  const normalize = (value) => value.replaceAll('_', '-').toLowerCase();
  const mapped = {};
  for (const locale of locales) {
    const target = overrides[locale] || locale;
    const matches = languages.filter(
      (language) => normalize(language.lang_iso) === normalize(target),
    );
    if (matches.length !== 1)
      throw new Error(
        `No unique Lokalise language for ${locale}; specify localeMap.${locale} using the configured lang_iso.`,
      );
    mapped[locale] = matches[0].lang_iso;
  }
  if (new Set(Object.values(mapped)).size !== locales.length)
    throw new Error(
      'Locale mapping must not collapse two repository locales into one translation.',
    );
  if (Object.keys(overrides).some((locale) => !locales.includes(locale)))
    throw new Error('localeMap contains an unknown repository locale.');
  return mapped;
}

module.exports = {
  ROOT,
  LOCALES_PATH,
  ENUM_PATH,
  GENERATED_PATHS,
  digest,
  readJson,
  writeJson,
  localKey,
  memberKey,
  loadCatalog,
  fileHashes,
  generatedHashes,
  assertHashes,
  messageSignature,
  validateTranslations,
  normalizeDraft,
  mapLanguages,
  workflowMode,
};
