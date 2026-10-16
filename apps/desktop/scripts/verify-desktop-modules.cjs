'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const repository = 'OneKeyHQ/app-modules';
const workflow = `${repository}/.github/workflows/desktop-win-release.yml`;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releaseVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-alpha\.[1-9]\d*)?$/;
const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const proofFiles = ['desktop-win.json', 'desktop-win.sigstore.json'];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validateSourceRef(sourceRef) {
  if (
    typeof sourceRef !== 'string' ||
    !/^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(sourceRef) ||
    sourceRef.includes('..') ||
    sourceRef
      .slice('refs/heads/'.length)
      .split('/')
      .some(
        (part) =>
          !part ||
          part.startsWith('.') ||
          part.endsWith('.') ||
          part.endsWith('.lock'),
      )
  )
    assert.fail('Invalid source branch ref');
  return sourceRef;
}

function releaseChannel(version, sourceRef) {
  validateSourceRef(sourceRef);
  if (!releaseVersionPattern.test(version))
    assert.fail('Invalid desktop release version');
  if (version.includes('-alpha.')) return 'next';
  if (sourceRef !== 'refs/heads/main')
    assert.fail('Stable npm releases require main');
  return 'latest';
}

function validateBaseline(baseline) {
  if (
    baseline.schemaVersion !== 1 ||
    !releaseVersionPattern.test(baseline.version) ||
    !versionPattern.test(baseline.electronVersion) ||
    baseline.version.split('.')[0] !== baseline.electronVersion.split('.')[0] ||
    !versionPattern.test(baseline.rustToolchain) ||
    JSON.stringify(baseline.modules?.win) !== '["electron-windows-hello"]' ||
    !Array.isArray(baseline.modules?.mac) ||
    baseline.modules.mac.length !== 0 ||
    !Array.isArray(baseline.modules?.linux) ||
    baseline.modules.linux.length !== 0
  ) {
    assert.fail(
      'Invalid desktop baseline or unsupported module build contract',
    );
  }
  return baseline;
}

function validatePin(pin) {
  validateSourceRef(pin.sourceRef);
  if (
    pin.schemaVersion !== 1 ||
    !releaseVersionPattern.test(pin.version) ||
    !commitPattern.test(pin.sourceCommit) ||
    !digestPattern.test(pin.manifestSha256)
  ) {
    assert.fail('Invalid approved desktop release pin');
  }
  releaseChannel(pin.version, pin.sourceRef);
  return pin;
}

function validateRelease(release) {
  validateBaseline(release.baseline);
  validateSourceRef(release.sourceRef);
  if (
    release.schemaVersion !== 2 ||
    release.repository !== repository ||
    release.workflow !== workflow ||
    !commitPattern.test(release.sourceCommit) ||
    JSON.stringify(Object.keys(release.modules ?? {})) !==
      JSON.stringify(release.baseline.modules.win)
  ) {
    assert.fail('Invalid desktop release identity');
  }
  for (const [name, entry] of Object.entries(release.modules)) {
    const nativeBinarySuffix = '-msvc.node';
    const expectedFiles = [
      'LICENSE',
      'README.md',
      'index.cjs',
      'index.d.ts',
      'package.json',
      `${name}.win32-x64${nativeBinarySuffix}`,
      `${name}.win32-arm64${nativeBinarySuffix}`,
    ].toSorted();
    if (
      entry.packageName !== `@onekeyfe/${name}` ||
      entry.asset !== `onekeyfe-${name}-${release.baseline.version}.tgz` ||
      JSON.stringify(Object.keys(entry.files ?? {}).toSorted()) !==
        JSON.stringify(expectedFiles) ||
      Object.values(entry.files).some((digest) => !digestPattern.test(digest))
    ) {
      assert.fail(`Invalid runtime file inventory for ${name}`);
    }
  }
  return release;
}

function attestationArgs(file, sourceCommit, sourceRef, bundle) {
  if (!commitPattern.test(sourceCommit)) assert.fail('Invalid source commit');
  validateSourceRef(sourceRef);
  return [
    'attestation',
    'verify',
    file,
    '--repo',
    repository,
    '--signer-workflow',
    workflow,
    '--source-digest',
    sourceCommit,
    '--signer-digest',
    sourceCommit,
    '--source-ref',
    sourceRef,
    '--deny-self-hosted-runners',
    ...(bundle ? ['--bundle', bundle] : []),
  ];
}

function verifyAttestation(file, sourceCommit, sourceRef, bundle) {
  execFileSync('gh', attestationArgs(file, sourceCommit, sourceRef, bundle), {
    stdio: 'inherit',
  });
}

function readApprovedRelease(file, pin) {
  validatePin(pin);
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) !== pin.manifestSha256)
    assert.fail('Desktop manifest digest mismatch');
  const release = validateRelease(JSON.parse(bytes));
  if (
    release.sourceCommit !== pin.sourceCommit ||
    release.sourceRef !== pin.sourceRef ||
    release.baseline.version !== pin.version
  ) {
    assert.fail('Desktop manifest does not match the approved source/version');
  }
  return release;
}

function verifyRuntimeFiles(directory, files, metadata = []) {
  const actual = fs.readdirSync(directory).toSorted();
  if (
    JSON.stringify(actual) !==
    JSON.stringify([...Object.keys(files), ...metadata].toSorted())
  ) {
    assert.fail(`Unexpected or missing runtime files in ${directory}`);
  }
  for (const name of metadata) {
    if (
      path.basename(name) !== name ||
      !fs.lstatSync(path.join(directory, name)).isFile()
    ) {
      assert.fail('Invalid runtime metadata file');
    }
  }
  for (const [name, digest] of Object.entries(files)) {
    if (path.basename(name) !== name || !digestPattern.test(digest)) {
      assert.fail('Invalid runtime inventory');
    }
    const file = path.join(directory, name);
    if (
      !fs.lstatSync(file).isFile() ||
      sha256(fs.readFileSync(file)) !== digest
    ) {
      assert.fail(`Runtime file digest mismatch: ${name}`);
    }
  }
}

function main() {
  if (process.platform !== 'win32') return;
  const desktopRoot = path.resolve(__dirname, '..');
  const pin = validatePin(
    JSON.parse(fs.readFileSync(path.join(desktopRoot, 'desktop-modules.json'))),
  );
  const app = JSON.parse(
    fs.readFileSync(path.join(desktopRoot, 'package.json')),
  );
  const appDir = path.join(desktopRoot, 'app');
  const runtimeManifest = JSON.parse(
    fs.readFileSync(path.join(appDir, 'package.json')),
  );
  for (const name of ['electron-windows-hello']) {
    const packageName = `@onekeyfe/${name}`;
    if (
      app.dependencies[packageName] !== pin.version ||
      runtimeManifest.dependencies[packageName] !== pin.version
    ) {
      assert.fail(`Unpinned npm runtime dependency: ${packageName}`);
    }
    const directory = path.join(appDir, 'node_modules', packageName);
    const file = path.join(directory, 'desktop-win.json');
    const release = readApprovedRelease(file, pin);
    if (app.devDependencies.electron !== release.baseline.electronVersion) {
      assert.fail(
        'Electron differs from the approved desktop validation baseline',
      );
    }
    verifyRuntimeFiles(directory, release.modules[name].files, proofFiles);
    verifyAttestation(
      file,
      pin.sourceCommit,
      pin.sourceRef,
      path.join(directory, 'desktop-win.sigstore.json'),
    );
  }
  console.log(
    `Verified desktop Windows npm modules ${pin.version} from ${pin.sourceCommit}`,
  );
}

module.exports = {
  repository,
  workflow,
  proofFiles,
  sha256,
  validateSourceRef,
  releaseChannel,
  validateBaseline,
  validatePin,
  validateRelease,
  attestationArgs,
  verifyAttestation,
  readApprovedRelease,
  verifyRuntimeFiles,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
