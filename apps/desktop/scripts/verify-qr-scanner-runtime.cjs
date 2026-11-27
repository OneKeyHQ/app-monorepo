const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const runtime = require('../app/package.json');
const workspace = require('../package.json');
const pin = require('../qr-scanner-release.json');

const packageName = '@onekeyfe/electron-qr-scanner';
const inventoryFile = 'desktop-qr-scanner.json';
const proofFile = 'desktop-qr-scanner.sigstore.json';
const root = join(__dirname, '../app/node_modules', packageName);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function electronMajor(version) {
  assert.equal(
    typeof version,
    'string',
    `Invalid Electron version: ${String(version)}`,
  );
  const match = /^(\d+)\.\d+\.\d+/.exec(version);
  assert(match, `Invalid Electron semver: ${version}`);
  return match[1];
}

function packageFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile()) return [entry.name];
    assert(
      entry.isDirectory(),
      `Unexpected QR scanner package entry: ${entry.name}`,
    );
    return packageFiles(join(directory, entry.name)).map(
      (child) => `${entry.name}/${child}`,
    );
  });
}

assert.equal(workspace.dependencies[packageName], pin.version);
assert.equal(runtime.dependencies[packageName], pin.version);
assert(
  lstatSync(root).isDirectory(),
  'QR scanner package must be installed in appDir',
);
assert(
  lstatSync(join(root, inventoryFile)).isFile(),
  'QR scanner inventory must be a file',
);

// This pin comes from the inventory verified against app-modules' build attestation.
const inventoryBytes = readFileSync(join(root, inventoryFile));
assert.equal(
  sha256(inventoryBytes),
  pin.inventorySha256,
  'QR scanner inventory digest mismatch',
);
const inventory = JSON.parse(inventoryBytes);
assert.equal(inventory.schemaVersion, 1);
assert.equal(inventory.name, packageName);
assert.equal(inventory.version, pin.version);
assert.equal(inventory.sourceCommit, pin.sourceCommit);
assert.equal(inventory.sourceRef, pin.sourceRef);
assert.equal(
  electronMajor(inventory.electron),
  electronMajor(workspace.devDependencies.electron),
  `QR scanner Electron major mismatch: inventory=${inventory.electron}, desktop=${workspace.devDependencies.electron}`,
);

const expectedFiles = [
  ...Object.keys(inventory.files),
  inventoryFile,
  proofFile,
].toSorted();
assert.deepEqual(
  packageFiles(root).toSorted(),
  expectedFiles,
  'Unexpected QR scanner package contents',
);
for (const [file, expectedHash] of Object.entries(inventory.files)) {
  assert.equal(
    sha256(readFileSync(join(root, file))),
    expectedHash,
    `QR scanner release digest mismatch: ${file}`,
  );
}
