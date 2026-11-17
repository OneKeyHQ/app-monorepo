/* eslint-disable no-restricted-syntax, onekey/no-raw-error -- standalone build tooling */
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../../..');
// Only explicitly public Firefox settings belong in a distributable manifest.
const publicKeys = [
  'NODE_ENV',
  'VERSION',
  'BUNDLE_VERSION',
  'BUILD_NUMBER',
  'BUILD_TIME',
  'GITHUB_SHA',
  'WORKFLOW_GITHUB_SHA',
  'ONEKEY_PLATFORM',
  'PUBLIC_URL',
  'EXT_INJECT_RELOAD_BUTTON',
  'EXT_INJECT_MODE',
  'EXT_CHANNEL',
  'ONEKEY_BUILD_TYPE',
  'TAMAGUI_TARGET',
  'HARDWARE_SDK_CONNECT_SRC',
  'WALLETCONNECT_PROJECT_ID',
  'SENTRY_DSN_EXT',
  'SUPABASE_PROJECT_URL',
  'SUPABASE_PUBLIC_API_KEY',
].toSorted();
const systemKeys = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'TMP',
  'TEMP',
  'SystemRoot',
  'SYSTEMROOT',
  'COMSPEC',
  'PATHEXT',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
  'YARN_ENABLE_GLOBAL_CACHE',
  'YARN_CACHE_FOLDER',
  'YARN_GLOBAL_FOLDER',
  'COREPACK_HOME',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
]);
function prepareEnvironment(env = process.env) {
  for (const key of Object.keys(env)) {
    if (!systemKeys.has(key) && !publicKeys.includes(key)) delete env[key];
  }
  Object.assign(env, fixedEnvironment);
}
const fixedEnvironment = {
  NODE_ENV: 'production',
  EXT_CHANNEL: 'firefox',
  EXT_MANIFEST_V3: '1',
  ONEKEY_PLATFORM: 'ext',
  TAMAGUI_TARGET: 'web',
  ONEKEY_FONTS_FORCE_FALLBACK: '1',
  ONEKEY_REQUIRE_PRIVATE_FONTS: '0',
  ONEKEY_REPRODUCIBLE_BUILD: '1',
  TZ: 'UTC',
};

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getCommit(env = process.env) {
  let commit = env.WORKFLOW_GITHUB_SHA || env.GITHUB_SHA;
  if (fs.existsSync(path.join(repoRoot, '.git'))) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    if (commit && commit !== head)
      throw new Error('Build SHA does not match the checked-out source.');
    commit = head;
  }
  if (!/^[a-f0-9]{40}$/.test(commit || ''))
    throw new Error('A full source commit SHA is required.');
  return commit;
}

function createBuildManifest(env = process.env) {
  const environment = Object.fromEntries(
    publicKeys.map((key) => [key, env[key] ?? null]),
  );
  const commit = getCommit(env);
  environment.GITHUB_SHA = commit;
  return {
    schemaVersion: 1,
    browser: 'firefox',
    sourceCommit: commit,
    yarnLockSha256: sha256(fs.readFileSync(path.join(repoRoot, 'yarn.lock'))),
    nodeVersion: process.version,
    yarnVersion: JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    ).packageManager,
    fontSource: 'fallback',
    environment,
  };
}

function validateManifestMetadata(manifest) {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.browser !== 'firefox' ||
    manifest.fontSource !== 'fallback'
  )
    throw new Error('Unsupported Firefox build manifest.');
  if (manifest.nodeVersion !== process.version)
    throw new Error(
      `Use Node ${manifest.nodeVersion} to reproduce this release.`,
    );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  );
  if (manifest.yarnVersion !== pkg.packageManager)
    throw new Error('Yarn version differs from the source package.');
  if (
    manifest.yarnLockSha256 !==
    sha256(fs.readFileSync(path.join(repoRoot, 'yarn.lock')))
  )
    throw new Error('yarn.lock differs from the release.');
}

function validateManifestEnvironment(env, sourceCommit) {
  if (
    !env ||
    Object.keys(env).length !== publicKeys.length ||
    publicKeys.some(
      (key) =>
        !Object.hasOwn(env, key) ||
        !(env[key] === null || typeof env[key] === 'string'),
    )
  )
    throw new Error('Invalid public build environment.');
  if (
    env.GITHUB_SHA !== sourceCommit ||
    (env.WORKFLOW_GITHUB_SHA && env.WORKFLOW_GITHUB_SHA !== sourceCommit)
  )
    throw new Error('Conflicting source commit parameters.');
}

function validateReleaseParameters(env) {
  if (
    !/^\d{13}$/.test(env.BUILD_TIME || '') ||
    Number(env.BUILD_TIME) < Date.UTC(2000, 0, 1) ||
    Number(env.BUILD_TIME) >= Date.UTC(2108, 0, 1)
  )
    throw new Error('BUILD_TIME must be Unix milliseconds.');
  if (
    !/^\d{1,9}(?:\.\d{1,9}){0,3}$/.test(env.VERSION || '') ||
    env.VERSION.split('.').some(
      (part) => part.length > 1 && part.startsWith('0'),
    )
  )
    throw new Error('Invalid Firefox version.');
  for (const key of ['BUILD_NUMBER', 'BUNDLE_VERSION']) {
    if (!/^\d+$/.test(env[key] || ''))
      throw new Error(`Missing release parameter: ${key}`);
  }
  for (const [key, value] of Object.entries(fixedEnvironment)) {
    if (Object.hasOwn(env, key) && env[key] !== value)
      throw new Error(`Invalid Firefox release parameter: ${key}`);
  }
}

function validateManifest(manifest) {
  validateManifestMetadata(manifest);
  validateManifestEnvironment(manifest.environment, manifest.sourceCommit);
  validateReleaseParameters(manifest.environment);
  getCommit({ GITHUB_SHA: manifest.sourceCommit });
}

function applyManifest(manifest) {
  validateManifest(manifest);
  prepareEnvironment();
  for (const key of publicKeys) {
    if (manifest.environment[key] === null) delete process.env[key];
    else process.env[key] = manifest.environment[key];
  }
  Object.assign(process.env, fixedEnvironment);
}

function walkFiles(root, prefix = '') {
  const result = [];
  for (const name of fs.readdirSync(path.join(root, prefix)).toSorted()) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const info = fs.lstatSync(path.join(root, relative));
    if (info.isDirectory()) result.push(...walkFiles(root, relative));
    else if (info.isFile()) result.push(relative);
    else throw new Error(`Unsupported build asset: ${relative}`);
  }
  return result;
}

function getDosTime(date) {
  return (
    (((date.getUTCFullYear() - 1980) << 25) |
      ((date.getUTCMonth() + 1) << 21) |
      (date.getUTCDate() << 16) |
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      (date.getUTCSeconds() >> 1)) >>>
    0
  );
}

function packageFirefox(outputRoot, distRoot) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(outputRoot, 'firefox-build.json'), 'utf8'),
  );
  validateManifest(manifest);
  const AdmZip = require('adm-zip');
  const archive = new AdmZip({ noSort: true });
  const dosTime = getDosTime(new Date(Number(manifest.environment.BUILD_TIME)));
  const checksums = [];
  for (const file of walkFiles(outputRoot)) {
    const content = fs.readFileSync(path.join(outputRoot, file));
    checksums.push(`${sha256(content)}  ${file}`);
    archive.addFile(file, content, '', 0o644);
    const entry = archive.getEntry(file);
    // cspell:disable-next-line
    entry.header.timeval = dosTime;
    entry.header.made = 0x03_14;
  }
  fs.mkdirSync(distRoot, { recursive: true });
  const name = `OneKey-Wallet-${manifest.environment.VERSION}-firefox.zip`;
  archive.writeZip(path.join(distRoot, name));
  fs.copyFileSync(
    path.join(outputRoot, 'firefox-build.json'),
    path.join(distRoot, 'firefox-build.json'),
  );
  fs.writeFileSync(
    path.join(distRoot, 'firefox-files.sha256'),
    `${checksums.join('\n')}\n`,
  );
  fs.writeFileSync(
    path.join(distRoot, `${name}.sha256`),
    `${sha256(fs.readFileSync(path.join(distRoot, name)))}  ${name}\n`,
  );
  return path.join(distRoot, name);
}

module.exports = {
  repoRoot,
  publicKeys,
  prepareEnvironment,
  fixedEnvironment,
  getCommit,
  createBuildManifest,
  validateManifest,
  applyManifest,
  packageFirefox,
  sha256,
};
