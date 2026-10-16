'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repository = 'OneKeyHQ/app-modules';
const workflow = `${repository}/.github/workflows/desktop-win-release.yml`;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validateBaseline(baseline) {
  if (
    baseline.schemaVersion !== 1 ||
    !versionPattern.test(baseline.version) ||
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
  if (
    pin.schemaVersion !== 1 ||
    !versionPattern.test(pin.version) ||
    !commitPattern.test(pin.sourceCommit) ||
    !digestPattern.test(pin.manifestSha256)
  ) {
    assert.fail('Invalid approved desktop release pin');
  }
  return pin;
}

function validateRelease(release) {
  validateBaseline(release.baseline);
  if (
    release.schemaVersion !== 1 ||
    release.repository !== repository ||
    release.workflow !== workflow ||
    !commitPattern.test(release.sourceCommit) ||
    release.tag !== `desktop-win-v${release.baseline.version}` ||
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
      entry.asset !== `${name}-${release.baseline.version}.tgz` ||
      !digestPattern.test(entry.sha256) ||
      JSON.stringify(Object.keys(entry.files ?? {}).toSorted()) !==
        JSON.stringify(expectedFiles) ||
      Object.values(entry.files).some((digest) => !digestPattern.test(digest))
    ) {
      assert.fail(`Invalid runtime file inventory for ${name}`);
    }
  }
  return release;
}

function attestationArgs(file, sourceCommit, bundle) {
  if (!commitPattern.test(sourceCommit)) assert.fail('Invalid source commit');
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
    'refs/heads/main',
    '--deny-self-hosted-runners',
    ...(bundle ? ['--bundle', bundle] : []),
  ];
}

function verifyAttestation(file, sourceCommit, bundle) {
  execFileSync('gh', attestationArgs(file, sourceCommit, bundle), {
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
    release.baseline.version !== pin.version
  ) {
    assert.fail('Desktop manifest does not match the approved source/version');
  }
  return release;
}

function verifyRuntimeFiles(directory, files) {
  const actual = fs.readdirSync(directory).toSorted();
  if (
    JSON.stringify(actual) !== JSON.stringify(Object.keys(files).toSorted())
  ) {
    assert.fail(`Unexpected or missing runtime files in ${directory}`);
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

async function download(url, destination) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok)
    assert.fail(`Desktop release download failed: ${response.status}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 8 * 1024 * 1024)
      assert.fail('Desktop release metadata exceeds size limit');
    chunks.push(Buffer.from(chunk));
  }
  fs.writeFileSync(destination, Buffer.concat(chunks));
}

async function main() {
  if (process.platform !== 'win32') return;
  const desktopRoot = path.resolve(__dirname, '..');
  const pin = validatePin(
    JSON.parse(fs.readFileSync(path.join(desktopRoot, 'desktop-modules.json'))),
  );
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-desktop-verify-'),
  );
  try {
    const url = `https://github.com/${repository}/releases/download/desktop-win-v${pin.version}`;
    for (const name of ['desktop-win.json', 'desktop-win.sigstore.json']) {
      await download(`${url}/${name}`, path.join(temporary, name));
    }
    const file = path.join(temporary, 'desktop-win.json');
    const release = readApprovedRelease(file, pin);
    verifyAttestation(
      file,
      pin.sourceCommit,
      path.join(temporary, 'desktop-win.sigstore.json'),
    );
    const app = JSON.parse(
      fs.readFileSync(path.join(desktopRoot, 'package.json')),
    );
    if (app.devDependencies.electron !== release.baseline.electronVersion) {
      assert.fail(
        'Electron differs from the approved desktop validation baseline',
      );
    }
    for (const [name, entry] of Object.entries(release.modules)) {
      const expectedUrl = `https://github.com/${repository}/releases/download/${release.tag}/${entry.asset}`;
      const appDir = path.join(desktopRoot, 'app');
      const runtimeManifest = JSON.parse(
        fs.readFileSync(path.join(appDir, 'package.json')),
      );
      if (
        app.dependencies[name] !== expectedUrl ||
        runtimeManifest.dependencies[name] !== expectedUrl
      ) {
        assert.fail(`Unpinned runtime dependency: ${name}`);
      }
      verifyRuntimeFiles(path.join(appDir, 'node_modules', name), entry.files);
    }
    console.log(
      `Verified desktop Windows modules ${pin.version} from ${pin.sourceCommit}`,
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = {
  repository,
  workflow,
  sha256,
  validateBaseline,
  validatePin,
  validateRelease,
  attestationArgs,
  verifyAttestation,
  readApprovedRelease,
  verifyRuntimeFiles,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
