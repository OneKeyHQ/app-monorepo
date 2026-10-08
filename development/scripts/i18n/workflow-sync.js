const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  ROOT,
  GENERATED_PATHS,
  digest,
  loadCatalog,
  mapLanguages,
  generatedHashes,
  assertHashes,
  readJson,
  writeJson,
} = require('./workflow-data');

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function workspace(root = ROOT) {
  const branch = git(root, ['branch', '--show-current']);
  if (!branch || branch === 'x')
    throw new Error(
      'Use a feature branch before preparing generated translations.',
    );
  return { branch, head: git(root, ['rev-parse', 'HEAD']) };
}

function assertGeneratedClean(root = ROOT) {
  if (git(root, ['status', '--porcelain', '--', ...GENERATED_PATHS]))
    throw new Error(
      'Generated locale files have local changes. Preserve/review them before pulling; this workflow will not overwrite them.',
    );
}

function validateSync(sync, root) {
  const { checksum, ...content } = sync;
  if (
    sync.kind !== 'i18n-sync' ||
    sync.schemaVersion !== 1 ||
    sync.status !== 'complete' ||
    checksum !== digest(content)
  )
    throw new Error('Invalid or incomplete initial pull record.');
  if (workspace(root).branch !== sync.workspace.branch)
    throw new Error('Current branch differs from the initial pull.');
  assertHashes(root, sync.generatedFiles, 'Generated files since initial pull');
  if (digest(generatedHashes(root)) !== digest(sync.generatedFiles))
    throw new Error('Generated file set changed since initial pull.');
  return sync;
}

function readSync(file, root = ROOT) {
  return validateSync(readJson(file), root);
}

function assertGeneratedBaseline(root, sync) {
  if (sync) validateSync(sync, root);
  else assertGeneratedClean(root);
}

function pull(projectContext, root, outputRoot) {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'development/scripts/i18n/i18n-pull.js'),
      '--expected-project-id',
      projectContext.project.id,
      ...(outputRoot ? ['--output-root', outputRoot] : []),
    ],
    {
      cwd: path.join(root, 'packages/shared'),
      stdio: 'inherit',
      env: { ...process.env, LOKALISE_PROJECT_ID: projectContext.project.id },
    },
  );
}

async function syncWorkspace({
  client,
  projectName,
  file,
  root = ROOT,
  localeMap: overrides,
  previousSync,
  verifyCurrent = false,
  pullImpl = pull,
}) {
  if (!projectName)
    throw new Error('Pass --project-name for the intended initial pull.');
  if (fs.existsSync(file))
    throw new Error('Initial pull record already exists; choose a new path.');
  const base = workspace(root);
  if (verifyCurrent && previousSync)
    throw new Error('Choose either --sync or --verify-current.');
  if (!verifyCurrent) assertGeneratedBaseline(root, previousSync);
  const beforeHashes = generatedHashes(root);
  const before = loadCatalog(root);
  const project = await client.project(projectName);
  if (
    previousSync &&
    (project.id !== previousSync.project.id ||
      project.name !== previousSync.project.name)
  )
    throw new Error('Refresh project differs from the initial pull.');
  const localeMap = mapLanguages(
    before.locales,
    project.languages,
    overrides || previousSync?.localeMap || {},
  );
  // Credential lookup can take time. Recheck immediately before the generator writes.
  if (!verifyCurrent) assertGeneratedBaseline(root, previousSync);
  assertHashes(root, beforeHashes, 'Generated files before initial pull');
  const sync = {
    schemaVersion: 1,
    kind: 'i18n-sync',
    status: 'pulling',
    project: { id: project.id, name: project.name },
    workspace: base,
    localeMap,
    startedAt: new Date().toISOString(),
    changes: [...(previousSync?.changes || [])],
    ...(previousSync ? { previousSyncChecksum: previousSync.checksum } : {}),
  };
  writeJson(file, sync);
  try {
    let outputRoot;
    if (verifyCurrent) {
      outputRoot = fs.mkdtempSync(
        path.join(path.dirname(file), 'pull-verification-'),
      );
      sync.verificationDirectory = outputRoot;
      writeJson(file, sync);
    }
    await Promise.resolve(pullImpl(sync, root, outputRoot));
    if (verifyCurrent) {
      assertHashes(root, beforeHashes, 'Generated files during verified pull');
      if (digest(generatedHashes(outputRoot)) !== digest(generatedHashes(root)))
        throw new Error(
          `Fresh pull differs from local generated files. Current files were preserved; compare ${outputRoot} before continuing.`,
        );
    }
    const after = loadCatalog(outputRoot || root);
    if (digest(before.locales) !== digest(after.locales))
      throw new Error(
        'Repository locale set changed during initial pull; review the generated diff.',
      );
    for (const locale of after.locales) {
      for (const key of new Set([
        ...Object.keys(before.values[locale]),
        ...Object.keys(after.values[locale]),
      ])) {
        if (
          before.values[locale][key] !== after.values[locale][key] &&
          !sync.changes.some(
            (change) => change.key === key && change.locale === locale,
          )
        )
          sync.changes.push({ key, locale });
      }
    }
    sync.generatedFiles = generatedHashes(root);
    sync.status = 'complete';
    sync.finishedAt = new Date().toISOString();
    sync.checksum = digest(sync);
    writeJson(file, sync);
    return sync;
  } catch (error) {
    sync.status = 'failed';
    sync.error = error.message;
    writeJson(file, sync);
    throw error;
  }
}

module.exports = {
  git,
  workspace,
  assertGeneratedClean,
  assertGeneratedBaseline,
  readSync,
  syncWorkspace,
  pull,
};
