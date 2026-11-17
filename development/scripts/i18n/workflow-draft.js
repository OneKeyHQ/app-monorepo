const fs = require('node:fs');

const {
  ROOT,
  readJson,
  writeJson,
  loadCatalog,
  digest,
  workflowMode,
} = require('./workflow-data');

function compactDraft(draft) {
  return {
    mode: workflowMode(draft.mode),
    locales: draft.locales,
    summary: draft.summary,
    dependencies: draft.dependencies,
    unresolved: draft.unresolved,
    review: draft.review,
    reviewNotesReviewed: draft.reviewNotesReviewed,
    entries: draft.entries.map((entry) => ({
      id: entry.id,
      key: entry.key,
      action: entry.action,
      role: entry.role,
      en_US: entry.translations.en_US,
      zh_CN: entry.translations.zh_CN,
      missingLocales: draft.locales.filter(
        (locale) =>
          typeof entry.translations[locale] !== 'string' ||
          !entry.translations[locale].trim(),
      ),
      reuseKeys: entry.reuseKeys,
      reviewNote: entry.reviewNote,
      translationReviewNotes: entry.translationReviewNotes,
      reviewResponse: entry.reviewResponse,
      sources: entry.sources,
    })),
  };
}

function saveDraft(draft, file, { update = false } = {}) {
  if (fs.existsSync(file) && !update)
    throw new Error('Draft file already exists; choose a new output path.');
  writeJson(file, draft);
  writeJson(`${file}.summary.json`, compactDraft(draft));
  return {
    draft: file,
    mode: workflowMode(draft.mode),
    summary: `${file}.summary.json`,
    entries: draft.entries.length,
    locales: draft.locales.length,
  };
}

function fillDraft(file, patchFile, root = ROOT) {
  const draft = readJson(file);
  const patch = readJson(patchFile);
  if (draft.kind !== 'i18n-draft' || !Array.isArray(patch.entries))
    throw new Error('Expected a draft and a patch with entries.');
  const catalog = loadCatalog(root);
  if (patch.table) {
    const { ids, columns } = patch.table;
    if (
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      !columns ||
      typeof columns !== 'object'
    )
      throw new Error(
        'Translation table requires unique candidate ids and locale columns.',
      );
    for (const [locale, values] of Object.entries(columns)) {
      if (
        !catalog.locales.includes(locale) ||
        !Array.isArray(values) ||
        values.length !== ids.length ||
        values.some((value) => typeof value !== 'string' || !value.trim())
      )
        throw new Error(`Invalid translation table column: ${locale}.`);
      ids.forEach((id, index) => {
        const matches = patch.entries.filter((entry) => entry.id === id);
        if (matches.length !== 1)
          throw new Error(
            `Table id must identify exactly one patch decision: ${id}.`,
          );
        const entry = matches[0];
        if (Object.hasOwn(entry.translations || {}, locale))
          throw new Error(`Translation supplied twice: ${id}/${locale}.`);
        entry.translations = { ...entry.translations, [locale]: values[index] };
      });
    }
  }
  const matched = new Set();
  for (const change of patch.entries) {
    const matches = draft.entries.filter((entry) =>
      change.id ? change.id === entry.id : change.key === entry.key,
    );
    if (matches.length !== 1 || matched.has(matches[0]?.id))
      throw new Error(
        `Patch must identify exactly one candidate once: ${change.id || change.key}`,
      );
    const entry = matches[0];
    matched.add(entry.id);
    if (change.reuse) {
      if (!Object.hasOwn(catalog.values.en_US, change.reuse))
        throw new Error(`Unknown local reuse key: ${change.reuse}`);
      entry.key = change.reuse;
      entry.preserveRemoteLocales = catalog.locales;
      entry.translations = Object.fromEntries(
        catalog.locales.map((locale) => [
          locale,
          catalog.values[locale][change.reuse] ?? null,
        ]),
      );
    }
    for (const name of ['key', 'action', 'reason', 'reviewResponse'])
      if (Object.hasOwn(change, name)) entry[name] = change[name];
    if (change.translations) {
      if (
        draft.review &&
        Object.hasOwn(change.translations, 'en_US') &&
        change.translations.en_US !== entry.translations.en_US
      ) {
        for (const locale of catalog.locales) {
          if (
            locale !== 'en_US' &&
            !Object.hasOwn(change.translations, locale)
          ) {
            entry.translations[locale] = null;
            entry.preserveRemoteLocales = (
              entry.preserveRemoteLocales || []
            ).filter((item) => item !== locale);
          }
        }
      }
      entry.translations = { ...entry.translations, ...change.translations };
      entry.preserveRemoteLocales = (entry.preserveRemoteLocales || []).filter(
        (locale) => !Object.hasOwn(change.translations, locale),
      );
    }
  }
  if (Object.hasOwn(patch, 'unresolvedReviewed'))
    draft.unresolvedReviewed = patch.unresolvedReviewed === true;
  if (Object.hasOwn(patch, 'reviewNotesReviewed'))
    draft.reviewNotesReviewed = patch.reviewNotesReviewed === true;
  if (patch.localeMap) draft.localeMap = patch.localeMap;
  return saveDraft(draft, file, { update: true });
}

function singleDraft(key, translations, root = ROOT, mode) {
  const { locales } = loadCatalog(root);
  return {
    schemaVersion: 1,
    kind: 'i18n-draft',
    mode: workflowMode(mode),
    locales,
    localeMap: {},
    sourceFiles: {},
    unresolved: [],
    dependencies: [],
    entries: [
      {
        id: digest(key).slice(0, 16),
        key,
        action: 'upsert',
        sources: [],
        translations: {
          ...Object.fromEntries(locales.map((locale) => [locale, null])),
          ...translations,
        },
      },
    ],
  };
}

module.exports = { compactDraft, saveDraft, fillDraft, singleDraft };
