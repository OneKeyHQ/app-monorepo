const fs = require('node:fs');
const path = require('node:path');

const { translationRecords } = require('./workflow-client-central');
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

// The approval covers one onekey-i18n branch and release channel.
function assertTarget(plan, client) {
  const approved = plan.central;
  const current = {
    base: client.base ?? 'main',
    channel: client.channel ?? 'latest',
  };
  if (approved.base !== current.base || approved.channel !== current.channel)
    throw new Error(
      `The plan was approved for onekey-i18n ${approved.base} (${approved.channel} release), but this shell targets ${current.base} (${current.channel} release). Set ONEKEY_I18N_BASE and ONEKEY_I18N_CHANNEL as they were for the preview, or prepare another preview.`,
    );
}

// The client that checks the project before apply writes or pulls. A plan
// prepared before targets were recorded has an unknown target, so apply only
// continues it when an earlier apply opened its PR, and checks it against that
// PR's pinned commit instead of the shell's release.
function projectClient(plan, client, proposal, clientAt) {
  if (plan.central) {
    assertTarget(plan, client);
    return client;
  }
  if (proposal?.commit && clientAt) return clientAt(proposal.commit);
  throw new Error(
    'The plan predates recording its onekey-i18n branch and release channel, so its target is unknown. Prepare another preview.',
  );
}

async function verifyProject(plan, client, root) {
  const project = await client.project();
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
  // Client reading an onekey-i18n commit; resumes plans that predate targets.
  clientAt,
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
    status: 'preflight',
    operations: [],
  };
  // Set once the receipt file is known to be this plan's and not finished;
  // until then a failure must leave the file as it is (it may record an open PR).
  let owned = false;
  try {
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
      // A finished apply opened an onekey-i18n PR whose content main may not
      // have yet; the pulled local files are what can still be checked.
      if (previous.status === 'complete') {
        // Only re-verifies local files. A plan without a recorded target (which
        // may have finished without a PR) can't be checked and is left as before.
        if (plan.central) assertTarget(plan, client);
        // verifyLocal reads only the plan's languages, so check that the
        // local catalog has no others before reporting the plan as done.
        if (digest(loadCatalog(root).locales) !== digest(plan.locales))
          throw new Error(
            'Language coverage changed since this plan finished; prepare another preview.',
          );
        verifyLocal(plan, root);
        return previous;
      }
      if (previous.proposal) receipt.proposal = previous.proposal;
    }
    const checked = projectClient(plan, client, receipt.proposal, clientAt);
    owned = true;
    await verifyProject(plan, checked, root);
    if (workspace(root).branch !== plan.workspace.branch)
      throw new Error('Current branch differs from the preview.');
    assertHashes(root, plan.sourceFiles, 'Source');
    assertGeneratedBaseline(root, plan.sync);
    assertHashes(root, plan.generatedFiles, 'Generated files');
    const before = loadCatalog(root);
    // A rerun after the onekey-i18n PR was opened only pulls and verifies.
    if (!receipt.proposal)
      await writeEntries(plan, client, receipt, receiptFile);
    // A concurrent local edit during the write must not be overwritten by pull.
    assertGeneratedBaseline(root, plan.sync);
    assertHashes(root, plan.generatedFiles, 'Generated files');
    receipt.status = 'pulling';
    writeJson(receiptFile, receipt);
    await Promise.resolve(
      pullImpl(plan, root, undefined, {
        pr: receipt.proposal?.number,
        commit: receipt.proposal?.commit,
      }),
    );
    receipt.verification = verifyLocal(plan, root, before);
    receipt.status = 'complete';
    receipt.finishedAt = new Date().toISOString();
    writeJson(receiptFile, receipt);
    return receipt;
  } catch (error) {
    if (owned) {
      receipt.failedStage = receipt.status;
      receipt.status = 'failed';
      receipt.error = error.message;
      writeJson(receiptFile, receipt);
    }
    throw error;
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockFile);
  }
}

async function writeEntries(plan, client, receipt, receiptFile) {
  // Validate every key before any write. Recheck each key immediately before mutation.
  for (const entry of plan.entries) await inspectEntry(entry, plan, client);
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
  // onekey-i18n edits land as one commit on a new branch with an open PR.
  if (client.finalize) {
    receipt.proposal = await client.finalize(proposalFor(plan));
    writeJson(receiptFile, receipt);
  }
}

function proposalFor(plan) {
  const branch = plan.workspace.branch;
  return {
    title: `feat: app copy from ${branch}`,
    body: [
      `Copy for app-monorepo branch \`${branch}\` (${plan.mode} mode, approval \`${plan.approval.slice(0, 12)}\`).`,
      '',
      ...plan.entries.map((entry) => `- \`${entry.key}\``),
      '',
    ].join('\n'),
    branchHint: `app-${branch.replace(/[^A-Za-z0-9._-]+/g, '-')}`,
    // One branch per approved plan, so a rerun finds the PR it already opened.
    key: plan.approval.slice(0, 12),
  };
}

/**
 * The verify command. Until the onekey-i18n PR that apply opened is merged and
 * released, the approved copy is only in that PR, so the commit recorded in
 * this plan's receipt is checked; without one, the release (client) is.
 */
async function verifyPlan({ file, client, clientAt, root = ROOT }) {
  const plan = readPlan(file);
  const receiptFile = `${file}.receipt.json`;
  const receipt = fs.existsSync(receiptFile) ? readJson(receiptFile) : null;
  const proposal =
    receipt?.approval === plan.approval ? receipt.proposal : undefined;
  const remote = proposal?.commit ? clientAt(proposal.commit) : client;
  await verifyProject(plan, remote, root);
  await verifyRemote(plan, remote);
  return {
    ...verifyLocal(plan, root),
    checked: proposal?.commit ? proposal.url : 'release',
  };
}

module.exports = {
  applyPlan,
  verifyLocal,
  verifyPlan,
  verifyRemote,
  verifyProject,
  inspectEntry,
};
