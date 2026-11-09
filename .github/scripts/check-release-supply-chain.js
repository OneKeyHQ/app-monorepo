const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const YAML = require('yaml');

const DYNAMIC_TOOL =
  /\b(?:npx|yarn\s+dlx)\s+(?:--\S+\s+)*(?:eas-cli|eas|tsx)(?=[@\s]|$)/u;
const PINNED_ACTION = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[a-f\d]{40}$/u;
const PINNED_IMAGE = /^docker:\/\/[^\s@]+@sha256:[a-f\d]{64}$/u;
const DOWNLOAD_TOOL = /\b(?:npx|yarn\s+dlx)\b/u;

function actionReferences(document) {
  const references = [];
  for (const job of Object.values(document.jobs || {})) {
    if (job.uses) references.push(job.uses);
    for (const step of job.steps || []) {
      if (step.uses) references.push(step.uses);
    }
  }
  for (const step of document.runs?.steps || []) {
    if (step.uses) references.push(step.uses);
  }
  return references;
}

function checkReleaseSupplyChain(root) {
  const errors = [];
  const workflowDir = path.join(root, '.github/workflows');
  const pending = fs
    .readdirSync(workflowDir)
    .filter((name) =>
      /^(?:release.*|daily-build.*|lint|security-checks)\.ya?ml$/u.test(name),
    )
    .map((name) => `.github/workflows/${name}`);
  const visited = new Set(pending);
  const enqueue = (file) => {
    if (!visited.has(file)) {
      visited.add(file);
      pending.push(file);
    }
  };
  if (!pending.some((name) => path.basename(name).startsWith('release'))) {
    errors.push('No release workflows found');
  }
  while (pending.length) {
    const file = pending.pop();
    try {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      const document = YAML.parse(text);
      for (const reference of actionReferences(document)) {
        assert.equal(
          typeof reference,
          'string',
          'Action references must be strings',
        );
        if (reference.startsWith('./')) {
          const target = path.resolve(root, reference);
          assert.ok(
            target.startsWith(`${path.resolve(root)}${path.sep}`),
            `Local action escapes repository: ${reference}`,
          );
          if (fs.statSync(target).isDirectory()) {
            const manifest = ['action.yml', 'action.yaml']
              .map((name) => path.join(target, name))
              .find((name) => fs.existsSync(name));
            assert.ok(manifest, `Missing local action: ${reference}`);
            enqueue(path.relative(root, manifest));
          } else {
            enqueue(path.relative(root, target));
          }
        } else {
          if (!PINNED_ACTION.test(reference) && !PINNED_IMAGE.test(reference)) {
            errors.push(`${file}: unpinned action ${reference}`);
          }
          if (reference.startsWith('expo/expo-github-action@')) {
            errors.push(
              `${file}: use the locked CI EAS project instead of installing EAS through an action`,
            );
          }
        }
      }
      for (const job of Object.values(document.jobs || {})) {
        for (const step of job.steps || []) {
          if (DOWNLOAD_TOOL.test(step.run || '')) {
            errors.push(
              `${file}: use locked local tools instead of npx/yarn dlx`,
            );
          }
        }
      }
      for (const step of document.runs?.steps || []) {
        if (DOWNLOAD_TOOL.test(step.run || '')) {
          errors.push(
            `${file}: use locked local tools instead of npx/yarn dlx`,
          );
        }
      }
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }

  try {
    const toolsDir = path.join(root, '.github/tools/eas-cli');
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
    const config = YAML.parse(
      fs.readFileSync(path.join(toolsDir, '.yarnrc.yml'), 'utf8'),
    );
    if (config.enableScripts !== false || config.afterInstall !== '') {
      errors.push(
        'CI EAS install must disable dependency scripts and the parent postinstall hook',
      );
    }
    const manifestRoot = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    );
    for (const [name, command] of Object.entries(manifestRoot.scripts || {})) {
      if (DYNAMIC_TOOL.test(command))
        errors.push(`package.json: ${name} dynamically downloads EAS/tsx`);
    }
  } catch (error) {
    errors.push(`CI EAS project: ${error.message}`);
  }
  return { errors, files: [...visited].toSorted() };
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
