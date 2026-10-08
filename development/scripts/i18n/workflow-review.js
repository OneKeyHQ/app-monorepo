const {
  digest,
  localKey,
  memberKey,
  workflowMode,
} = require('./workflow-data');

function reviewModel(plan, { planFile = '', applied = false, feedback } = {}) {
  let initialState;
  if (feedback) {
    if (
      createReviewedDraft(plan, feedback, { applied }).action !== 'revise-draft'
    )
      throw new Error('Prefilled review requires revision feedback.');
    const changes = new Map(
      feedback.changes.map((entry) => [entry.key, entry]),
    );
    initialState = {
      mode: workflowMode(feedback.mode),
      entries: plan.entries.map((entry) => {
        const change = changes.get(entry.key);
        return {
          key: change?.newKey || entry.key,
          translations: { ...entry.translations, ...change?.translations },
          note: change?.note?.trim() || '',
          translationNotes: change?.translationNotes || {},
        };
      }),
    };
  }
  return {
    project: plan.project,
    approval: plan.approval,
    planFile,
    applied,
    mode: plan.mode,
    previousApproval: plan.review?.baseApproval,
    ...(initialState ? { initialState, revisionId: digest(initialState) } : {}),
    locales: plan.locales,
    entries: plan.entries.map((entry) => ({
      key: entry.key,
      translations: entry.translations,
      existing: applied || Boolean(entry.keyId),
      before: applied
        ? entry.translations
        : Object.fromEntries(
            plan.locales.map((locale) => [
              locale,
              entry.before?.[locale].value ?? '',
            ]),
          ),
      sources: entry.sources || [],
      reviewResponse: entry.reviewResponse || '',
    })),
  };
}

function parseFeedback(text) {
  if (typeof text !== 'string' || text.length > 2_000_000)
    throw new Error('Feedback must be text smaller than 2 MB.');
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  if (blocks.length > 1)
    throw new Error('Expected exactly one feedback JSON block.');
  let feedback;
  try {
    feedback = JSON.parse(blocks.length ? blocks[0][1] : text);
  } catch {
    throw new Error(
      'Paste the complete generated prompt or its feedback JSON.',
    );
  }
  if (
    feedback?.kind !== 'i18n-review' ||
    feedback.schemaVersion !== 1 ||
    !Array.isArray(feedback.changes) ||
    !['approve', 'revise'].includes(feedback.intent)
  )
    throw new Error('Invalid i18n-review feedback.');
  return feedback;
}

function createReviewedDraft(
  plan,
  feedback,
  { applied = false, baseline } = {},
) {
  if (feedback.baseApproval !== plan.approval)
    throw new Error(
      'Feedback belongs to another preview. Use its original plan.',
    );
  const mode = workflowMode(feedback.mode);
  const entries = new Map(plan.entries.map((entry) => [entry.key, entry]));
  const changes = new Map();
  for (const change of feedback.changes) {
    if (!change || !entries.has(change.key) || changes.has(change.key))
      throw new Error('Feedback contains an unknown or duplicate source key.');
    if (
      change.newKey !== undefined &&
      (typeof change.newKey !== 'string' ||
        !/^[a-zA-Z0-9_.$:]+$/.test(change.newKey))
    )
      throw new Error(`Invalid edited key: ${change.key}`);
    if (
      change.note !== undefined &&
      (typeof change.note !== 'string' || change.note.length > 4000)
    )
      throw new Error(`Invalid review note: ${change.key}`);
    if (
      change.translations !== undefined &&
      (!change.translations ||
        typeof change.translations !== 'object' ||
        Array.isArray(change.translations))
    )
      throw new Error(`Invalid edited translations: ${change.key}`);
    const original = entries.get(change.key);
    const translations = {};
    for (const [locale, value] of Object.entries(change.translations || {})) {
      if (
        !plan.locales.includes(locale) ||
        typeof value !== 'string' ||
        !value.trim() ||
        value.length > 20_000
      )
        throw new Error(`Invalid edited translation: ${change.key}/${locale}`);
      if (value !== original.translations[locale]) translations[locale] = value;
    }
    const newKey = change.newKey || change.key;
    const before = applied
      ? original.translations
      : Object.fromEntries(
          plan.locales.map((locale) => [
            locale,
            original.before?.[locale].value ?? '',
          ]),
        );
    if (
      mode === 'complete' &&
      localKey(newKey) === original.localKey &&
      (applied || original.keyId) &&
      Object.entries(translations).some(
        ([locale, value]) => before[locale].trim() && before[locale] !== value,
      )
    )
      throw new Error(
        `${change.key}: complete mode cannot overwrite non-empty translations. Choose update in the review page.`,
      );
    const note = change.note?.trim() || '';
    if (
      change.translationNotes !== undefined &&
      (!change.translationNotes ||
        typeof change.translationNotes !== 'object' ||
        Array.isArray(change.translationNotes))
    )
      throw new Error(`Invalid translation comments: ${change.key}`);
    const translationNotes = {};
    for (const [locale, value] of Object.entries(
      change.translationNotes || {},
    )) {
      if (
        !plan.locales.includes(locale) ||
        typeof value !== 'string' ||
        value.length > 4000
      )
        throw new Error(`Invalid translation comment: ${change.key}/${locale}`);
      if (value.trim()) translationNotes[locale] = value.trim();
    }
    if (
      newKey !== change.key ||
      Object.keys(translations).length ||
      note ||
      Object.keys(translationNotes).length
    )
      changes.set(change.key, { newKey, translations, note, translationNotes });
  }
  const revised = changes.size > 0 || mode !== plan.mode;
  if (feedback.intent === 'approve') {
    if (revised)
      throw new Error(
        'Edited feedback cannot approve the old plan. Generate a revision request.',
      );
    return {
      action: applied ? 'already-applied' : 'approve-plan',
      approval: plan.approval,
    };
  }
  if (!revised) throw new Error('Revision contains no changes.');
  if (
    baseline &&
    (!baseline.sync ||
      baseline.kind !== 'i18n-draft' ||
      baseline.sync.project.id !== plan.project.id ||
      baseline.sync.project.name !== plan.project.name)
  )
    throw new Error(
      'A refreshed baseline must be a scanned draft with a sync from the same project.',
    );
  const names = new Set();
  const members = new Set();
  const revisedEntries = plan.entries.map((entry) => {
    const change = changes.get(entry.key);
    const refreshedSources = baseline?.references?.find(
      (reference) => localKey(reference.key) === localKey(entry.key),
    )?.sources;
    const key = change?.newKey || entry.key;
    const normalized = localKey(key);
    const member = memberKey(key);
    if (names.has(normalized) || members.has(member))
      throw new Error(`Edited keys collide: ${key}`);
    names.add(normalized);
    members.add(member);
    const translations = { ...entry.translations, ...change?.translations };
    const sourceChanged = Object.hasOwn(change?.translations || {}, 'en_US');
    const missing = [];
    if (sourceChanged) {
      for (const locale of plan.locales) {
        if (locale !== 'en_US' && !Object.hasOwn(change.translations, locale)) {
          translations[locale] = null;
          missing.push(locale);
        }
      }
    }
    return {
      id: digest(entry.key).slice(0, 16),
      key,
      action: 'upsert',
      translations,
      sources: refreshedSources || entry.sources || [],
      preserveRemoteLocales: plan.locales.filter(
        (locale) =>
          !Object.hasOwn(change?.translations || {}, locale) &&
          !missing.includes(locale),
      ),
      ...(change?.note ? { reviewNote: change.note } : {}),
      ...(Object.keys(change?.translationNotes || {}).length
        ? { translationReviewNotes: change.translationNotes }
        : {}),
    };
  });
  const context = baseline || plan;
  return {
    action: 'revise-draft',
    draft: {
      schemaVersion: 1,
      kind: 'i18n-draft',
      mode,
      locales: plan.locales,
      localeMap: context.localeMap,
      ...(context.sync ? { sync: context.sync } : {}),
      sourceFiles: context.sourceFiles,
      unresolved: context.unresolved || [],
      unresolvedReviewed: !context.unresolved?.length,
      review: {
        baseApproval: plan.approval,
        requiresRefresh: applied && !baseline,
      },
      reviewNotesReviewed: !revisedEntries.some(
        (entry) =>
          entry.reviewNote ||
          Object.keys(entry.translationReviewNotes || {}).length,
      ),
      entries: revisedEntries,
    },
  };
}

module.exports = { reviewModel, parseFeedback, createReviewedDraft };
