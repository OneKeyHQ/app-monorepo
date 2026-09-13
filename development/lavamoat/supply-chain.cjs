// cspell:ignore LIFECYCLES Syml Unreviewed shellcode

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { LavaMoatError } = require('./error.cjs');

const POLICY_PATH = 'lavamoat/supply-chain/install-scripts.json';
const LIFECYCLES = ['preinstall', 'install', 'postinstall'];

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function fail(message) {
  throw new LavaMoatError(`[LavaMoat supply chain] ${message}`);
}

function normalizeLocator(locator) {
  return locator.replace(/@virtual:[^#]+#/, '@');
}

function packageName(locator) {
  const match = /^(@[^/]+\/[^@]+|[^@]+)@/.exec(locator);
  if (!match) fail(`Invalid Yarn locator: ${locator}`);
  return match[1];
}

function lifecycleScripts(directory) {
  const manifest = readJson(path.join(directory, 'package.json'));
  const scripts = {};
  for (const event of LIFECYCLES) {
    if (Object.hasOwn(manifest.scripts || {}, event)) {
      if (typeof manifest.scripts[event] !== 'string') {
        fail(`Invalid ${event} script in ${directory}`);
      }
      scripts[event] = manifest.scripts[event];
    }
  }
  const implicitNodeGyp =
    !Object.hasOwn(scripts, 'preinstall') &&
    !Object.hasOwn(scripts, 'install') &&
    fs.existsSync(path.join(directory, 'binding.gyp'));
  if (implicitNodeGyp) scripts.install = 'node-gyp rebuild';
  return { version: manifest.version, scripts, implicitNodeGyp };
}

function publishedFileHashes(directory, expected) {
  const hashes = {};
  const realRoot = fs.realpathSync(directory);
  for (const relative of Object.keys(expected).toSorted()) {
    const filename = path.resolve(directory, relative);
    const real = fs.realpathSync(filename);
    if (!real.startsWith(`${realRoot}${path.sep}`)) {
      fail(`Published source path escapes its package: ${relative}`);
    }
    hashes[relative] = createHash('sha256')
      .update(fs.readFileSync(filename))
      .digest('hex');
  }
  return hashes;
}

function loadContext(root, parseSyml, workspaces = [root]) {
  const manifest = readJson(path.join(root, 'package.json'));
  const policy = readJson(path.join(root, POLICY_PATH));
  if (policy.version !== 1 || !Array.isArray(policy.packages)) {
    fail(`Unsupported policy format in ${POLICY_PATH}`);
  }
  const lock = parseSyml(fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8'));
  const resolutions = new Map();
  for (const [key, value] of Object.entries(lock)) {
    if (key !== '__metadata') resolutions.set(value.resolution, value);
  }
  const approvals = new Map();
  for (const entry of policy.packages) {
    if (
      typeof entry.resolution !== 'string' ||
      typeof entry.version !== 'string' ||
      typeof entry.allow !== 'boolean' ||
      typeof entry.reason !== 'string' ||
      !entry.reason.trim() ||
      !entry.scripts ||
      typeof entry.scripts !== 'object' ||
      Array.isArray(entry.scripts) ||
      typeof entry.implicitNodeGyp !== 'boolean' ||
      (typeof entry.checksum !== 'string' && entry.checksum !== null)
    ) {
      fail(`Invalid approval: ${entry.resolution || '<missing resolution>'}`);
    }
    if (approvals.has(entry.resolution))
      fail(`Duplicate approval: ${entry.resolution}`);
    if (entry.fileHashes) {
      if (
        typeof entry.fileHashes !== 'object' ||
        Array.isArray(entry.fileHashes) ||
        !Object.keys(entry.fileHashes).length
      ) {
        fail(`Invalid published file hashes: ${entry.resolution}`);
      }
      for (const [relative, hash] of Object.entries(entry.fileHashes)) {
        if (
          path.isAbsolute(relative) ||
          relative.split(/[\\/]/).includes('..') ||
          !/^[a-f0-9]{64}$/.test(hash)
        ) {
          fail(`Invalid published file hash: ${entry.resolution}/${relative}`);
        }
      }
    }
    if (
      entry.allow &&
      entry.checksum === null &&
      !entry.resolution.includes('@workspace:') &&
      !entry.fileHashes
    ) {
      fail(
        `Review the original archive file hashes before enabling checksum-less package: ${entry.resolution}`,
      );
    }
    approvals.set(entry.resolution, entry);
  }
  return {
    root,
    manifest,
    resolutions,
    approvals,
    parseSyml,
    workspaces,
    gitDependencies: policy.gitDependencies || [],
  };
}

function gitUrl(specifier) {
  if (typeof specifier !== 'string') return null;
  if (/^(?:npm|workspace|file|link|portal):/.test(specifier)) return null;
  if (specifier.startsWith('patch:')) {
    // Git wrapped in patch: must not bypass the admission hook during fetch.
    if (!/^patch:(?:@[^/]+\/)?[^@]+@npm(?:%3[Aa]|:)/.test(specifier))
      fail(
        `Patched dependencies must reference npm registry sources: ${specifier}`,
      );
    return null;
  }
  // Plain semver ranges and dist-tags have neither protocol nor repository path.
  if (!/[/:]/.test(specifier)) return null;
  const match =
    /^https:\/\/github\.com\/([^/#]+)\/([^/#]+?)(?:\.git)?#(?:commit=)?([a-f0-9]{40})$/.exec(
      specifier,
    );
  if (!match)
    fail(`Git dependencies must use HTTPS and a full commit SHA: ${specifier}`);
  return `https://github.com/${match[1]}/${match[2]}.git#commit=${match[3]}`;
}

function checkGitSpecifier(context, specifier) {
  const url = gitUrl(specifier);
  if (!url) return;
  const approved = context.gitDependencies.some(
    (entry) =>
      entry.resolution.slice(packageName(entry.resolution).length + 1) === url,
  );
  if (!approved) fail(`Review new Git source before install: ${url}`);
}

function checkGitDependencies(context) {
  const reviewed = new Map();
  for (const entry of context.gitDependencies) {
    if (
      !entry.reason?.trim() ||
      typeof entry.checksum !== 'string' ||
      reviewed.has(entry.resolution)
    ) {
      fail(`Invalid Git dependency approval: ${entry.resolution}`);
    }
    const name = packageName(entry.resolution);
    const source = entry.resolution.slice(name.length + 1);
    if (gitUrl(source) !== source)
      fail(`Invalid reviewed Git resolution: ${entry.resolution}`);
    reviewed.set(entry.resolution, entry);
  }
  const approvedUrls = new Set(
    [...reviewed.keys()].map((resolution) =>
      resolution.slice(packageName(resolution).length + 1),
    ),
  );
  for (const directory of context.workspaces) {
    const manifest = readJson(path.join(directory, 'package.json'));
    for (const specifier of Object.values({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.resolutions,
    })) {
      const url = gitUrl(specifier);
      if (url && !approvedUrls.has(url))
        fail(`Review new Git source before install: ${url}`);
    }
  }
  context.resolutions.forEach((locked, resolution) => {
    const source = resolution.slice(packageName(resolution).length + 1);
    const url = gitUrl(source);
    if (!url) return;
    const entry = reviewed.get(resolution);
    if (!entry || locked.checksum !== entry.checksum) {
      fail(
        `Review changed Git resolution/checksum before install: ${resolution}`,
      );
    }
  });
}

function checkConfiguration(context, enableScripts) {
  if (enableScripts !== false) fail('Yarn enableScripts must remain false.');
  checkGitDependencies(context);
  const expected = new Map();
  context.approvals.forEach((entry) => {
    if (!entry.allow || entry.resolution.includes('@workspace:')) return;
    const locked = context.resolutions.get(entry.resolution);
    if (
      !locked ||
      (locked.checksum || null) !== entry.checksum ||
      locked.version !== entry.version
    ) {
      fail(
        `Review the changed version/source/checksum before enabling scripts: ${entry.resolution}`,
      );
    }
    expected.set(`${packageName(entry.resolution)}@${entry.version}`, true);
  });
  for (const [selector, meta] of Object.entries(
    context.manifest.dependenciesMeta || {},
  )) {
    if (meta.built === true) {
      if (!expected.delete(selector))
        fail(`Unreviewed or unpinned built:true: ${selector}`);
    }
  }
  if (expected.size)
    fail(
      `Missing version-pinned built:true: ${[...expected.keys()].join(', ')}`,
    );
}

function readInstalled(context, targetDirectory) {
  const statePath = path.join(context.root, 'node_modules/.yarn-state.yml');
  if (!fs.existsSync(statePath))
    fail('Yarn node_modules state is missing; installation is incomplete.');
  const state = context.parseSyml(fs.readFileSync(statePath, 'utf8'));
  if (String(state.__metadata?.version) !== '1')
    fail('Unsupported Yarn node_modules state format.');
  const installed = [];
  Object.entries(state).forEach(([locator, data]) => {
    if (locator === '__metadata') return;
    if (!Array.isArray(data.locations))
      fail(`Missing installed locations: ${locator}`);
    data.locations.forEach((location) => {
      if (typeof location !== 'string')
        fail(`Invalid installed location: ${locator}`);
      const directory = path.resolve(context.root, location);
      const relative = path.relative(context.root, directory);
      if (
        relative === '..' ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      ) {
        fail(`Installed path escapes the project: ${location}`);
      }
      if (targetDirectory && path.resolve(targetDirectory) !== directory)
        return;
      const resolution = normalizeLocator(locator);
      const locked = context.resolutions.get(resolution);
      if (!locked)
        fail(`Installed dependency is absent from yarn.lock: ${resolution}`);
      const info = lifecycleScripts(directory);
      if (resolution.includes('@workspace:')) {
        // Workspace versions in yarn.lock are placeholders; source is reviewed in Git.
        if (!Object.keys(info.scripts).length) return;
      } else if (locked.version !== info.version) {
        fail(
          `Installed version differs from yarn.lock: ${resolution} (${info.version})`,
        );
      }
      installed.push({
        directory,
        resolution,
        version: info.version,
        scripts: info.scripts,
        implicitNodeGyp: info.implicitNodeGyp,
        checksum: locked.checksum || null,
        ...(context.approvals.get(resolution)?.fileHashes
          ? {
              fileHashes: publishedFileHashes(
                directory,
                context.approvals.get(resolution).fileHashes,
              ),
            }
          : {}),
      });
    });
  });
  return installed;
}

function verifyEntry(context, actual, executing = false) {
  const entry = context.approvals.get(actual.resolution);
  if (!Object.keys(actual.scripts).length && !entry) return;
  if (!entry)
    fail(
      `Lifecycle scripts need an explicit review decision: ${actual.resolution}`,
    );
  for (const key of [
    'version',
    'scripts',
    'implicitNodeGyp',
    'checksum',
    'fileHashes',
  ]) {
    try {
      assert.deepStrictEqual(actual[key], entry[key]);
    } catch {
      fail(`Reviewed ${key} changed: ${actual.resolution}`);
    }
  }
  if (executing && !entry.allow)
    fail(`Lifecycle execution is denied: ${actual.resolution}`);
}

function checkInstalled(context) {
  const installed = readInstalled(context);
  for (const actual of installed) verifyEntry(context, actual);
  return installed;
}

function checkExecution(context, manifestPath, lifecycleEvent) {
  if (!manifestPath) {
    if (LIFECYCLES.includes(lifecycleEvent))
      fail(
        `Cannot identify package before ${lifecycleEvent} lifecycle execution.`,
      );
    return;
  }
  const directory = path.dirname(manifestPath);
  const info = lifecycleScripts(directory);
  // Yarn's implicit node-gyp build uses shellcode without a lifecycle event.
  if (!LIFECYCLES.includes(lifecycleEvent) && !info.implicitNodeGyp) return;
  const candidates = readInstalled(context, directory);
  if (!candidates.length)
    fail(`Cannot identify package before lifecycle execution: ${manifestPath}`);
  for (const entry of candidates) verifyEntry(context, entry, true);
}

function inventory(context) {
  const entries = new Map();
  readInstalled(context).forEach(({ directory, ...actual }) => {
    if (!Object.keys(actual.scripts).length) return;
    const previous = context.approvals.get(actual.resolution);
    const entry = {
      ...actual,
      allow: false,
      reason: 'Pending review; scripts remain disabled.',
    };
    if (previous) {
      try {
        for (const key of [
          'version',
          'scripts',
          'implicitNodeGyp',
          'checksum',
          'fileHashes',
        ]) {
          assert.deepStrictEqual(actual[key], previous[key]);
        }
        entry.allow = previous.allow;
        entry.reason = previous.reason;
        if (previous.archiveSha512)
          entry.archiveSha512 = previous.archiveSha512;
      } catch {
        // A changed package never inherits an earlier execution approval.
      }
    }
    const duplicate = entries.get(actual.resolution);
    if (duplicate) assert.deepStrictEqual(entry, duplicate);
    entries.set(actual.resolution, entry);
  });
  return {
    version: 1,
    gitDependencies: context.gitDependencies,
    packages: [...entries.values()].toSorted((a, b) => {
      if (a.resolution === b.resolution) return 0;
      return a.resolution < b.resolution ? -1 : 1;
    }),
  };
}

module.exports = {
  POLICY_PATH,
  checkConfiguration,
  checkGitDependencies,
  checkGitSpecifier,
  checkExecution,
  checkInstalled,
  inventory,
  gitUrl,
  lifecycleScripts,
  loadContext,
  normalizeLocator,
  publishedFileHashes,
  readInstalled,
};
