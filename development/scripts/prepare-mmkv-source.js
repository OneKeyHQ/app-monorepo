#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const SPEC_PATH = 'apps/mobile/native/mmkv';
const SOURCE_PATHS = [
  'Core',
  'Android/MMKV/mmkv',
  'iOS/MMKV/MMKV',
  'MMKV.podspec',
  'MMKVCore.podspec',
  'LICENSE.TXT',
];
const GENERATED_HEADERS = [
  'MMKV.h',
  'MMKVPredef.h',
  'MMBuffer.h',
  'MiniPBCoder.h',
  'MMKVHandler.h',
  'MemoryFile.h',
  'MMKVLog.h',
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function verifyDigest(bytes, expected, label) {
  if (sha256(bytes) !== expected) {
    throw new Error(`MMKV ${label} SHA256 mismatch`);
  }
}

async function downloadArchive(lock) {
  const response = await fetch(lock.archive, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`MMKV source download failed: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function command(file, args, cwd) {
  const result = spawnSync(file, args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `MMKV ${file} failed: ${result.error?.message || result.stderr || result.stdout}`,
    );
  }
}

function sourceHashes(root, relative = '') {
  if (
    relative === 'onekey-source.json' ||
    relative === path.join('Core', 'include')
  ) {
    return {};
  }
  const absolute = path.join(root, relative);
  const stat = fs.lstatSync(absolute);
  if (stat.isDirectory()) {
    return Object.assign(
      {},
      ...fs
        .readdirSync(absolute)
        .map((name) => sourceHashes(root, path.join(relative, name))),
    );
  }
  if (!stat.isFile()) {
    throw new Error('MMKV archive contains a non-regular source file');
  }
  return {
    [relative.split(path.sep).join('/')]: sha256(fs.readFileSync(absolute)),
  };
}

function sourceTreeDigest(directory) {
  const files = sourceHashes(directory);
  return sha256(
    Object.keys(files)
      .toSorted()
      .map((file) => `${file}:${files[file]}\n`)
      .join(''),
  );
}

function verifyGeneratedHeaders(directory) {
  const include = path.join(directory, 'Core/include');
  const generated = path.join(include, 'MMKV');
  for (const [folder, expected] of [
    [include, ['MMKV']],
    [generated, GENERATED_HEADERS],
  ]) {
    if (
      !fs.lstatSync(folder).isDirectory() ||
      fs.readdirSync(folder).toSorted().join('\n') !==
        expected.toSorted().join('\n')
    ) {
      throw new Error('MMKV generated header directory mismatch');
    }
  }
  for (const file of GENERATED_HEADERS) {
    const header = path.join(generated, file);
    if (!fs.lstatSync(header).isFile()) {
      throw new Error('MMKV generated header is not a regular file');
    }
    verifyDigest(
      fs.readFileSync(header),
      sha256(fs.readFileSync(path.join(directory, 'Core', file))),
      file,
    );
  }
}

function verifyPreparedSource(directory, lock, patchDigest) {
  const receipt = JSON.parse(
    fs.readFileSync(path.join(directory, 'onekey-source.json'), 'utf8'),
  );
  if (
    receipt.commit !== lock.commit ||
    receipt.archiveSha256 !== lock.sha256 ||
    receipt.patchSha256 !== patchDigest
  ) {
    throw new Error('MMKV prepared source provenance mismatch');
  }
  // A restored cache and its receipt are both mutable. Anchor the actual file
  // tree to the reviewed lockfile, rather than trusting checksums in the cache.
  if (sourceTreeDigest(directory) !== lock.treeSha256) {
    throw new Error('MMKV prepared source tree SHA256 mismatch');
  }
  verifyGeneratedHeaders(directory);
}

async function prepareMMKVSource({
  rootDir = ROOT,
  readArchive = downloadArchive,
} = {}) {
  const specDirectory = path.join(rootDir, SPEC_PATH);
  const lock = JSON.parse(
    fs.readFileSync(path.join(specDirectory, 'source.lock.json'), 'utf8'),
  );
  if (
    lock.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/u.test(lock.commit) ||
    !/^[a-f0-9]{64}$/u.test(lock.sha256) ||
    !/^[a-f0-9]{64}$/u.test(lock.treeSha256) ||
    lock.archive !==
      `${lock.repository.replace('github.com', 'codeload.github.com')}/tar.gz/${lock.commit}` ||
    !lock.repository.startsWith('https://github.com/')
  ) {
    throw new Error('Invalid MMKV source pin');
  }
  const patchFile = path.join(specDirectory, 'checked-sync.patch');
  const patchDigest = sha256(fs.readFileSync(patchFile));
  const cache = path.join(rootDir, 'node_modules/.cache/onekey-mmkv-native');
  const directory = path.join(
    cache,
    `${lock.commit}-${patchDigest.slice(0, 12)}`,
  );
  if (fs.existsSync(directory)) {
    verifyPreparedSource(directory, lock, patchDigest);
    return directory;
  }

  fs.mkdirSync(cache, { recursive: true });
  const archiveFile = path.join(cache, `${lock.sha256}.tar.gz`);
  const archive = fs.existsSync(archiveFile)
    ? fs.readFileSync(archiveFile)
    : await readArchive(lock);
  verifyDigest(archive, lock.sha256, 'archive');
  if (!fs.existsSync(archiveFile)) {
    const temporaryArchive = `${archiveFile}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryArchive, archive);
      try {
        fs.renameSync(temporaryArchive, archiveFile);
      } catch (error) {
        if (!fs.existsSync(archiveFile)) throw error;
        verifyDigest(fs.readFileSync(archiveFile), lock.sha256, 'archive');
      }
    } finally {
      if (fs.existsSync(temporaryArchive)) fs.unlinkSync(temporaryArchive);
    }
  }
  const staging = fs.mkdtempSync(path.join(cache, 'preparing-'));
  try {
    const prefix = `MMKV-${lock.commit}`;
    command(
      'tar',
      [
        '-xzf',
        archiveFile,
        '--strip-components=1',
        '-C',
        staging,
        ...SOURCE_PATHS.map((entry) => `${prefix}/${entry}`),
      ],
      rootDir,
    );
    // Apply only to a verified, private staging tree. No factory, installed
    // Maven artifact, or other worktree is mutated by this preparation.
    command(
      'git',
      [
        '-c',
        'core.autocrlf=false',
        'apply',
        '--directory',
        path.relative(rootDir, staging).split(path.sep).join('/'),
        patchFile,
      ],
      rootDir,
    );
    // Materialize the complete upstream Android header export before caching.
    // Verify the exact set on reuse: extra headers could shadow <string>/JNI.
    const generated = path.join(staging, 'Core/include/MMKV');
    fs.mkdirSync(generated, { recursive: true });
    for (const file of GENERATED_HEADERS) {
      fs.copyFileSync(
        path.join(staging, 'Core', file),
        path.join(generated, file),
      );
    }
    verifyGeneratedHeaders(staging);
    if (sourceTreeDigest(staging) !== lock.treeSha256) {
      throw new Error('MMKV patched source tree SHA256 mismatch');
    }
    const receipt = {
      commit: lock.commit,
      archiveSha256: lock.sha256,
      patchSha256: patchDigest,
      files: sourceHashes(staging),
    };
    fs.writeFileSync(
      path.join(staging, 'onekey-source.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    try {
      fs.renameSync(staging, directory);
    } catch (error) {
      // Pod installation and Gradle may prepare the same immutable source
      // concurrently. Only accept the other result after verifying it.
      if (!fs.existsSync(directory)) throw error;
      verifyPreparedSource(directory, lock, patchDigest);
    }
  } finally {
    if (fs.existsSync(staging)) {
      fs.rmSync(staging, { recursive: true });
    }
  }
  return directory;
}

if (require.main === module) {
  prepareMMKVSource()
    .then((directory) => process.stdout.write(`${directory}\n`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { prepareMMKVSource, sha256, sourceTreeDigest, verifyDigest };
