const fs = require('node:fs');
const path = require('node:path');

const { translationRecords } = require('./workflow-client');
const {
  ROOT,
  ENUM_PATH,
  digest,
  loadCatalog,
  mapLanguages,
  validateTranslations,
  assertHashes,
  writeJson,
  readJson,
} = require('./workflow-data');
const { readPlan, workspace } = require('./workflow-plan');
const { assertGeneratedBaseline, pull } = require('./workflow-sync');

function desired(entry, records, locales) {
  return (
    records &&
    locales.every(
      (locale) => records[locale].value === entry.translations[locale],
    )
  );
}

async function verifyProject(plan, client, root) {
  if (client.projectId !== plan.project.id)
    throw new Error('Credential project differs from approved project.');
  const project = await client.project(plan.project.name);
  const locales = loadCatalog(root).locales;
  if (
    digest(locales) !== digest(plan.locales) ||
    digest(mapLanguages(locales, project.languages, plan.localeMap)) !==
      digest(plan.localeMap)
  )
    throw new Error('Language coverage changed; prepare another preview.');
  for (const entry of plan.entries)
    validateTranslations(entry.key, entry.translations, locales);
}

async function inspectEntry(entry, plan, client) {
  const key = await client.findKey(entry.key);
  const records = translationRecords(key, plan.localeMap);
  if (entry.keyId && key?.key_id !== entry.keyId)
    throw new Error(`${entry.key}: remote key identity changed.`);
  if (!entry.keyId && key && !desired(entry, records, plan.locales))
    throw new Error(
      `${entry.key}: a different key now occupies this name; regenerate the preview.`,
    );
  if (entry.before && records) {
    for (const locale of plan.locales) {
      if (
        records[locale].id !== entry.before[locale].id ||
        ![entry.before[locale].value, entry.translations[locale]].includes(
          records[locale].value,
        )
      )
        throw new Error(
          `${entry.key}/${locale}: remote translation changed after preview.`,
        );
    }
  }
  return { key, records };
}

async function verifyRemote(plan, client) {
  for (const entry of plan.entries) {
    const key = await client.findKey(entry.key);
    if (entry.keyId && key?.key_id !== entry.keyId)
      throw new Error(`${entry.key}: remote key identity changed.`);
    if (!desired(entry, translationRecords(key, plan.localeMap), plan.locales))
      throw new Error(
        `${entry.key}: remote translations do not match the approved plan.`,
      );
  }
}

function verifyLocal(plan, root = ROOT, before) {
  const catalog = loadCatalog(root);
  const enumText = fs.readFileSync(path.join(root, ENUM_PATH), 'utf8');
  const failures = [];
  for (const entry of plan.entries) {
    for (const locale of plan.locales)
      if (
        catalog.values[locale]?.[entry.localKey] !== entry.translations[locale]
      )
        failures.push(`${entry.localKey}/${locale}`);
    const escaped = entry.enumMember.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const member = enumText.match(
      new RegExp(`^\\s*${escaped}\\s*=\\s*['"]([^'"]+)['"]`, 'm'),
    );
    if (member?.[1] !== entry.localKey)
      failures.push(`ETranslations.${entry.enumMember}`);
  }
  if (failures.length)
    throw new Error(`Pulled output mismatch: ${failures.join(', ')}`);
  const planned = new Set(plan.entries.map((entry) => entry.localKey));
  const unrelated = [];
  if (before)
    for (const locale of catalog.locales)
      for (const key of new Set([
        ...Object.keys(before.values[locale] || {}),
        ...Object.keys(catalog.values[locale]),
      ])) {
        if (
          !planned.has(key) &&
          before.values[locale]?.[key] !== catalog.values[locale][key]
        )
          unrelated.push({ key, locale });
      }
  return {
    verifiedKeys: plan.entries.length,
    verifiedLocales: plan.locales,
    unrelatedChanges: unrelated,
  };
}

async function applyPlan({
  file,
  approval,
  client,
  root = ROOT,
  pullImpl = pull,
}) {
  if (!approval)
    throw new Error(
      'User confirmation is required. Pass --approve with the preview hash only after the user confirms.',
    );
  const plan = readPlan(file, approval);
  const receiptFile = `${file}.receipt.json`;
  const lockFile = `${file}.lock`;
  let lock;
  try {
    lock = fs.openSync(lockFile, 'wx');
  } catch {
    throw new Error(
      `Another apply owns ${lockFile}. Inspect the recorded process before recovering a stale lock.`,
    );
  }
  fs.writeFileSync(
    lock,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  );
  const receipt = {
    schemaVersion: 1,
    kind: 'i18n-receipt',
    approval,
    project: plan.project,
    status: 'preflight',
    operations: [],
  };
  try {
    await verifyProject(plan, client, root);
    if (fs.existsSync(receiptFile)) {
      const previous = readJson(receiptFile);
      if (previous.approval !== approval)
        throw new Error(
          'Receipt belongs to another plan; use a new plan file.',
        );
      receipt.operations = previous.operations || [];
      receipt.previousAttempts = [
        ...(previous.previousAttempts || []),
        {
          status: previous.status,
          failedStage: previous.failedStage,
          error: previous.error,
        },
      ];
      if (previous.status === 'complete') {
        await verifyRemote(plan, client);
        verifyLocal(plan, root);
        return previous;
      }
    }
    if (workspace(root).branch !== plan.workspace.branch)
      throw new Error('Current branch differs from the preview.');
    assertHashes(root, plan.sourceFiles, 'Source');
    assertGeneratedBaseline(root, plan.sync);
    assertHashes(root, plan.generatedFiles, 'Generated files');
    // Validate every key before any write. Recheck each key immediately before mutation.
    for (const entry of plan.entries) await inspectEntry(entry, plan, client);
    const before = loadCatalog(root);
    receipt.status = 'uploading';
    writeJson(receiptFile, receipt);
    for (const entry of plan.entries) {
      const { key, records } = await inspectEntry(entry, plan, client);
      if (!key) {
        await client.create(entry, plan.localeMap);
        receipt.operations.push({ key: entry.key, operation: 'create' });
        writeJson(receiptFile, receipt);
      } else {
        for (const locale of plan.locales.filter(
          (item) => records[item].value !== entry.translations[item],
        )) {
          if (plan.mode === 'complete' && records[locale].value.trim())
            throw new Error(
              `${entry.key}/${locale}: complete mode cannot overwrite a non-empty translation.`,
            );
          const { data } = await client.request(
            'GET',
            `/translations/${encodeURIComponent(records[locale].id)}`,
          );
          const current = data.translation;
          if (
            !current ||
            current.translation_id !== records[locale].id ||
            ![entry.before[locale].value, entry.translations[locale]].includes(
              current.translation,
            )
          )
            throw new Error(
              `${entry.key}/${locale}: concurrent translation update; stopped without overwriting it.`,
            );
          if (current.translation !== entry.translations[locale])
            await client.updateTranslation(
              records[locale].id,
              entry.translations[locale],
            );
          receipt.operations.push({
            key: entry.key,
            locale,
            operation: 'update',
          });
          writeJson(receiptFile, receipt);
        }
      }
    }
    await verifyRemote(plan, client);
    // A concurrent local edit during upload must not be overwritten by pull.
    assertGeneratedBaseline(root, plan.sync);
    assertHashes(root, plan.generatedFiles, 'Generated files');
    receipt.status = 'pulling';
    writeJson(receiptFile, receipt);
    await Promise.resolve(pullImpl(plan, root));
    receipt.verification = verifyLocal(plan, root, before);
    receipt.status = 'complete';
    receipt.finishedAt = new Date().toISOString();
    writeJson(receiptFile, receipt);
    return receipt;
  } catch (error) {
    receipt.failedStage = receipt.status;
    receipt.status = 'failed';
    receipt.error = error.message;
    writeJson(receiptFile, receipt);
    throw error;
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockFile);
  }
}

module.exports = {
  applyPlan,
  verifyLocal,
  verifyRemote,
  verifyProject,
  inspectEntry,
};
