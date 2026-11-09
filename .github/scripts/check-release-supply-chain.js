const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const YAML = require('yaml');

const DYNAMIC_TOOL =
  /\b(?:npx|yarn\s+dlx)\s+(?:--\S+\s+)*(?:eas-cli|eas|tsx)(?=[@\s]|$)/u;
const PINNED_ACTION = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[a-f\d]{40}$/u;
const PINNED_IMAGE = /^docker:\/\/[^\s@]+@sha256:[a-f\d]{64}$/u;
const DOWNLOAD_TOOL = /\b(?:npx|yarn\s+dlx)\b/u;
// cache-refresh publishes the dependency snapshot that release jobs restore.
const RELEASE_ROOTS =
  /^(?:release.*|daily-build.*|cache-refresh|lint|security-checks)\.ya?ml$/u;

function workflowSteps(document) {
  const steps = Object.values(document.jobs || {}).flatMap(
    (job) => job.steps || [],
  );
  return steps.concat(document.runs?.steps || []);
}

function actionReferences(document) {
  const jobs = Object.values(document.jobs || {}).map((job) => job.uses);
  const steps = workflowSteps(document).map((step) => step.uses);
  return jobs.concat(steps).filter(Boolean);
}

function localActionPath(root, reference) {
  const target = path.resolve(root, reference);
  assert.ok(
    target.startsWith(`${path.resolve(root)}${path.sep}`),
    `Local action escapes repository: ${reference}`,
  );
  if (!fs.statSync(target).isDirectory()) return path.relative(root, target);
  const manifest = ['action.yml', 'action.yaml']
    .map((name) => path.join(target, name))
    .find((name) => fs.existsSync(name));
  assert.ok(manifest, `Missing local action: ${reference}`);
  return path.relative(root, manifest);
}

function checkRemoteReference(reference, file, errors) {
  if (!PINNED_ACTION.test(reference) && !PINNED_IMAGE.test(reference)) {
    errors.push(`${file}: unpinned action ${reference}`);
  }
  if (reference.startsWith('expo/expo-github-action@')) {
    errors.push(
      `${file}: use the locked CI EAS project instead of installing EAS through an action`,
    );
  }
}

function checkWorkflow(root, file, errors) {
  const document = YAML.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const local = [];
  for (const reference of actionReferences(document)) {
    assert.equal(
      typeof reference,
      'string',
      'Action references must be strings',
    );
    if (reference.startsWith('./'))
      local.push(localActionPath(root, reference));
    else checkRemoteReference(reference, file, errors);
  }
  for (const step of workflowSteps(document)) {
    if (DOWNLOAD_TOOL.test(step.run || '')) {
      errors.push(`${file}: use locked local tools instead of npx/yarn dlx`);
    }
  }
  return local;
}

function workflowRoots(root) {
  return fs
    .readdirSync(path.join(root, '.github/workflows'))
    .filter((name) => RELEASE_ROOTS.test(name))
    .map((name) => `.github/workflows/${name}`);
}

function releaseGraph(root, errors) {
  const pending = workflowRoots(root);
  const visited = new Set(pending);
  if (!pending.some((name) => path.basename(name).startsWith('release'))) {
    errors.push('No release workflows found');
  }
  while (pending.length) {
    const file = pending.pop();
    try {
      for (const local of checkWorkflow(root, file, errors)) {
        if (!visited.has(local)) {
          visited.add(local);
          pending.push(local);
        }
      }
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  return Array.from(visited).toSorted();
}

function checkEasLock(toolsDir, errors) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(toolsDir, 'package.json'), 'utf8'),
  );
  const version = manifest.dependencies?.['eas-cli'];
  const lock = YAML.parse(
    fs.readFileSync(path.join(toolsDir, 'yarn.lock'), 'utf8'),
  );
  const entry = Object.entries(lock).find(([key]) =>
    key.split(', ').includes(`eas-cli@npm:${version}`),
  )?.[1];
  if (
    !/^\d+\.\d+\.\d+$/u.test(version || '') ||
    entry?.version !== version ||
    !entry.checksum
  ) {
    errors.push(
      'EAS CLI must have an exact version and a matching checksummed yarn.lock entry',
    );
  }
}

function checkEasInstallConfig(toolsDir, errors) {
  const config = YAML.parse(
    fs.readFileSync(path.join(toolsDir, '.yarnrc.yml'), 'utf8'),
  );
  if (config.enableScripts !== false || config.afterInstall !== '') {
    errors.push(
      'CI EAS install must disable dependency scripts and the parent postinstall hook',
    );
  }
}

function checkToolProjects(root, errors) {
  try {
    const toolsDir = path.join(root, '.github/tools/eas-cli');
    checkEasLock(toolsDir, errors);
    checkEasInstallConfig(toolsDir, errors);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    for (const [name, command] of Object.entries(manifest.scripts || {})) {
      if (DYNAMIC_TOOL.test(command))
        errors.push(`package.json: ${name} dynamically downloads EAS/tsx`);
    }
  } catch (error) {
    errors.push(`CI EAS project: ${error.message}`);
  }
}

function checkReleaseSupplyChain(root) {
  const errors = [];
  const files = releaseGraph(root, errors);
  checkToolProjects(root, errors);
  return { errors, files };
}

if (require.main === module) {
  const { errors, files } = checkReleaseSupplyChain(
    path.resolve(__dirname, '../..'),
  );
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Release supply chain: ${files.length} workflows/actions pinned; EAS CLI locked`,
    );
  }
}

module.exports = { checkReleaseSupplyChain };
