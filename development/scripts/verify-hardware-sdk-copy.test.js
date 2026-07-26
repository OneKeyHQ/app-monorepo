const assert = require('assert/strict');
const fs = require('fs');
const test = require('node:test');
const os = require('os');
const path = require('path');

const { verifyHardwareSdkCopy } = require('./verify-hardware-sdk-copy');

function writeFixture(rootDir, relativePath, content) {
  const filePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function makeCompleteSource(rootDir) {
  writeFixture(
    rootDir,
    'iframe.html',
    '<script>const script = document.createElement("script"); script.setAttribute("src", "./js/iframe.js");</script>',
  );
  writeFixture(rootDir, 'js/iframe.js', 'importScripts("../workers/hash.js");');
  writeFixture(rootDir, 'workers/hash.js', 'self.onmessage = () => {};');
  writeFixture(rootDir, 'data/messages/messages.json', '{"messages":[]}');
}

function copyDirectory(sourceDir, destinationDir) {
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
}

test('accepts an exact recursive copy with resolvable runtime assets', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hardware-sdk-copy-pass-'),
  );
  const sourceDir = path.join(rootDir, 'source');
  const destinationDir = path.join(rootDir, 'destination');
  makeCompleteSource(sourceDir);
  copyDirectory(sourceDir, destinationDir);
  try {
    assert.deepEqual(verifyHardwareSdkCopy({ sourceDir, destinationDir }), {
      fileCount: 4,
      referenceCount: 2,
    });
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test('rejects stale, missing, or changed destination files', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hardware-sdk-copy-diff-'),
  );
  const sourceDir = path.join(rootDir, 'source');
  const destinationDir = path.join(rootDir, 'destination');
  makeCompleteSource(sourceDir);
  copyDirectory(sourceDir, destinationDir);
  writeFixture(destinationDir, 'js/stale.js', 'stale');
  try {
    assert.throws(
      () => verifyHardwareSdkCopy({ sourceDir, destinationDir }),
      /Extra: js\/stale\.js/u,
    );
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test('rejects a copied iframe whose local runtime reference is absent', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hardware-sdk-copy-reference-'),
  );
  const sourceDir = path.join(rootDir, 'source');
  const destinationDir = path.join(rootDir, 'destination');
  writeFixture(
    sourceDir,
    'iframe.html',
    '<script src="./js/missing.js"></script>',
  );
  copyDirectory(sourceDir, destinationDir);
  try {
    assert.throws(
      () => verifyHardwareSdkCopy({ sourceDir, destinationDir }),
      /runtime references are missing/u,
    );
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});

test('compares the finalized production tree without sourcemaps or licenses', () => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hardware-sdk-copy-runtime-'),
  );
  const sourceDir = path.join(rootDir, 'source');
  const destinationDir = path.join(rootDir, 'destination');
  makeCompleteSource(sourceDir);
  writeFixture(sourceDir, 'js/iframe.js.map', '{}');
  writeFixture(sourceDir, 'js/iframe.js.LICENSE.txt', 'license');
  copyDirectory(sourceDir, destinationDir);
  fs.rmSync(path.join(destinationDir, 'js/iframe.js.map'));
  fs.rmSync(path.join(destinationDir, 'js/iframe.js.LICENSE.txt'));
  try {
    assert.deepEqual(
      verifyHardwareSdkCopy({
        sourceDir,
        destinationDir,
        runtimeOnly: true,
      }),
      {
        fileCount: 4,
        referenceCount: 2,
      },
    );
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
});
