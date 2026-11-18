/* cspell:ignore aapt xhdpi uncrunched udev onekeyd icns */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ELECTRON_ASAR_EXCLUDED_ICON_PATHS,
  generateOtaDiffBundle,
  isBuiltinNonPreservedFile,
  reconstructFromDiffBundle,
  resolveBuiltinCandidateRelPaths,
  sha256Buffer,
  validateDiffManifestSpec,
  validateFullMetadataSpec,
} = require('../generate-ota-diff-bundle');

function hashHex(content, algorithm) {
  return crypto.createHash(algorithm).update(content).digest('hex');
}

function writeFiles(rootDir, filesMap) {
  for (const [relPath, content] of Object.entries(filesMap)) {
    const absPath = path.join(rootDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content);
  }
}

function collectDirectoryFiles(rootDir) {
  const result = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const rel = path.relative(rootDir, fullPath).split(path.sep).join('/');
        result[rel] = fs.readFileSync(fullPath, 'utf8');
      }
    }
  };
  walk(rootDir);
  return result;
}

function mockCopyUnzip(stagingDir, outputZipPath) {
  // For fast unit testing without external zip/unzip binary dependency, store a directory copy alongside .zip
  fs.cpSync(stagingDir, `${outputZipPath}.extracted`, { recursive: true });
  fs.writeFileSync(outputZipPath, 'mock-zip-bytes');
}

test('Spec 1 (FullMetadataSpec): validates electron sha512 and mobile sha256 + reserved keys', () => {
  const validElectronMetadata = {
    'index.html': hashHex('<html></html>', 'sha512'),
    'static/js/main.js': hashHex('console.log(1)', 'sha512'),
  };
  const electronSpec = validateFullMetadataSpec(
    validElectronMetadata,
    'electron',
  );
  assert.equal(electronSpec.hashAlgorithm, 'sha512');
  assert.equal(Object.keys(electronSpec.fileEntries).length, 2);
  assert.equal(Object.keys(electronSpec.reservedEntries).length, 0);

  // Electron must reject mobile reserved non-file keys
  assert.throws(
    () =>
      validateFullMetadataSpec(
        {
          ...validElectronMetadata,
          storageSchemaVersion: 'mmkv-v1',
        },
        'electron',
      ),
    /must not contain reserved mobile key/,
  );

  // Electron must reject 64-char sha256 hashes
  assert.throws(
    () =>
      validateFullMetadataSpec(
        {
          'index.html': hashHex('<html></html>', 'sha256'),
        },
        'electron',
      ),
    /invalid sha512 hash/,
  );

  const validMobileMetadata = {
    'assets/node_modules/icon.png': hashHex('icon', 'sha256'),
    'background.bundle': hashHex('bg', 'sha256'),
    backgroundProtocolVersion: '1',
    bundleFormat: 'three-bundle',
    'common.bundle': hashHex('common', 'sha256'),
    'main.jsbundle.hbc': hashHex('main', 'sha256'),
    'module-id-map.json': hashHex('{}', 'sha256'),
    requiresBackgroundBundle: 'true',
    requiresCommonBundle: 'true',
    'segments-background/seg_bg.seg.hbc': hashHex('seg-bg', 'sha256'),
    'segments/seg_main.seg.hbc': hashHex('seg-main', 'sha256'),
    storageSchemaVersion: 'mmkv-v1',
    'web-embed/index.html': hashHex('web-embed', 'sha256'),
  };
  const iosSpec = validateFullMetadataSpec(validMobileMetadata, 'ios');
  assert.equal(iosSpec.hashAlgorithm, 'sha256');
  assert.equal(Object.keys(iosSpec.fileEntries).length, 8);
  assert.equal(Object.keys(iosSpec.reservedEntries).length, 5);

  // Rejects forbidden self-referential or traversal keys
  for (const badKey of [
    'metadata.json',
    'diff-manifest.json',
    '.DS_Store',
    '../secret.js',
    '/abs/path.js',
    'a\\b.js',
  ]) {
    assert.throws(
      () =>
        validateFullMetadataSpec(
          {
            [badKey]: hashHex('x', 'sha256'),
          },
          'ios',
        ),
      /forbidden|unsafe|traversal/,
    );
  }
});

test('Spec 2 (DiffManifestSpec): enforces 1-to-1 partition invariant against full metadata.json', () => {
  const fileAHash = hashHex('file-a', 'sha256');
  const fileBHash = hashHex('file-b', 'sha256');
  const targetMetadata = {
    'common.bundle': fileAHash,
    'main.jsbundle.hbc': fileBHash,
    storageSchemaVersion: 'mmkv-v1',
  };
  const targetMetadataBuffer = Buffer.from(
    JSON.stringify(targetMetadata, null, 2),
  );
  const targetMetadataSha256 = sha256Buffer(targetMetadataBuffer);

  const validDiffManifest = {
    schemaVersion: 1,
    appType: 'ios',
    appVersion: '6.8.0',
    baseAppVersion: '6.8.0',
    baseMetadataSha256: hashHex('base-meta', 'sha256'),
    targetBundleVersion: '7701200',
    targetMetadataSha256,
    hashAlgorithm: 'sha256',
    changedFiles: {
      'main.jsbundle.hbc': fileBHash,
    },
    reusedFiles: {
      'common.bundle': fileAHash,
    },
    deletedFiles: ['segments/old.seg.hbc'],
  };

  assert.equal(
    validateDiffManifestSpec(validDiffManifest, {
      appType: 'ios',
      appVersion: '6.8.0',
      bundleVersion: '7701200',
      targetMetadata,
      targetMetadataSha256,
    }),
    true,
  );

  // 1. Rejects when a file from metadata.json is omitted from both changedFiles and reusedFiles
  assert.throws(
    () =>
      validateDiffManifestSpec(
        {
          ...validDiffManifest,
          reusedFiles: {},
        },
        { targetMetadata, targetMetadataSha256 },
      ),
    /Partition count mismatch/,
  );

  // 2. Rejects when diff-manifest has an undeclared extra file not in metadata.json
  assert.throws(
    () =>
      validateDiffManifestSpec(
        {
          ...validDiffManifest,
          reusedFiles: {
            'common.bundle': fileAHash,
            'segments/extra.seg.hbc': hashHex('extra', 'sha256'),
          },
        },
        { targetMetadata, targetMetadataSha256 },
      ),
    /Partition count mismatch/,
  );

  // 3. Rejects when hash in diff-manifest disagrees with metadata.json
  assert.throws(
    () =>
      validateDiffManifestSpec(
        {
          ...validDiffManifest,
          reusedFiles: {
            'common.bundle': hashHex('tampered', 'sha256'),
          },
        },
        { targetMetadata, targetMetadataSha256 },
      ),
    /Partition mismatch/,
  );

  // 4. Rejects when changedFiles and reusedFiles overlap
  assert.throws(
    () =>
      validateDiffManifestSpec({
        ...validDiffManifest,
        changedFiles: {
          'common.bundle': fileAHash,
          'main.jsbundle.hbc': fileBHash,
        },
        reusedFiles: {
          'common.bundle': fileAHash,
        },
      }),
    /Overlapping file path/,
  );

  // 5. Rejects when deletedFiles overlaps changedFiles or reusedFiles
  assert.throws(
    () =>
      validateDiffManifestSpec({
        ...validDiffManifest,
        deletedFiles: ['common.bundle'],
      }),
    /overlaps changedFiles or reusedFiles/,
  );
});

test('End-to-End Reconstruction (iOS & Android): reconstructs all 8 bundle categories from diff bundle + built-in 6.8.0 app', () => {
  for (const appType of ['ios', 'android']) {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), `ota-e2e-${appType}-`),
    );
    try {
      const baseFiles = {
        'common.bundle': 'common-v680',
        'main.jsbundle.hbc': 'main-v680',
        'background.bundle': 'bg-v680',
        'module-id-map.json': '{"common":{"1":"index.ts"}}',
        'segments/seg_home.seg.hbc': 'seg-home-v680',
        'segments/seg_legacy.seg.hbc': 'seg-legacy-v680',
        'segments-background/seg_bg_core.seg.hbc': 'seg-bg-core-v680',
        'assets/node_modules/icon.png': 'png-bytes-v680',
        'web-embed/index.html': '<html>web-embed-v680</html>',
      };

      const targetFiles = {
        'common.bundle': 'common-v680', // reused
        'main.jsbundle.hbc': 'main-hotfix-1', // changed
        'background.bundle': 'bg-v680', // reused
        'module-id-map.json': '{"common":{"1":"index.ts"},"hotfix":true}', // changed
        'segments/seg_home.seg.hbc': 'seg-home-v680', // reused
        'segments/seg_new_feature.seg.hbc': 'seg-new-feature-hotfix-1', // added (changed)
        'segments-background/seg_bg_core.seg.hbc': 'seg-bg-core-v680', // reused
        'assets/node_modules/icon.png': 'png-bytes-v680', // reused
        'web-embed/index.html': '<html>web-embed-v680</html>', // reused
      };

      const buildMetadata = (files) => {
        const meta = {
          backgroundProtocolVersion: '1',
          bundleFormat: 'three-bundle',
          requiresBackgroundBundle: 'true',
          requiresCommonBundle: 'true',
          storageSchemaVersion: 'mmkv-v1',
        };
        for (const [k, content] of Object.entries(files)) {
          meta[k] = hashHex(content, 'sha256');
        }
        return Object.fromEntries(
          Object.entries(meta).toSorted(([a], [b]) => a.localeCompare(b)),
        );
      };

      const baseMetadata = buildMetadata(baseFiles);
      const targetMetadata = buildMetadata(targetFiles);

      const baseMetadataPath = path.join(tmpRoot, 'base-metadata.json');
      fs.writeFileSync(baseMetadataPath, JSON.stringify(baseMetadata, null, 2));

      // Create full target bundle dir (equivalent to full <platform>-bundle.zip extracted)
      const targetBundleDir = path.join(tmpRoot, 'target-full-bundle');
      writeFiles(targetBundleDir, targetFiles);
      fs.writeFileSync(
        path.join(targetBundleDir, 'metadata.json'),
        JSON.stringify(targetMetadata, null, 2),
      );

      // Create simulated 6.8.0 built-in app resource directory:
      // Note that on iOS built-in main.jsbundle.hbc is named `main.jsbundle`,
      // and on Android built-in main.jsbundle.hbc is named `index.android.bundle`!
      const builtinDir = path.join(tmpRoot, 'builtin-6.8.0');
      const builtinFilesOnDisk = { ...baseFiles };
      delete builtinFilesOnDisk['main.jsbundle.hbc'];
      builtinFilesOnDisk[
        appType === 'ios' ? 'main.jsbundle' : 'index.android.bundle'
      ] = baseFiles['main.jsbundle.hbc'];
      writeFiles(builtinDir, builtinFilesOnDisk);

      // Generate diff bundle
      const outputZipPath = path.join(tmpRoot, `${appType}-diff-bundle.zip`);
      generateOtaDiffBundle({
        appType,
        appVersion: '6.8.0',
        buildNumber: '2026111801',
        bundleVersion: '7701201',
        baseMetadataPath,
        targetBundleDir,
        outputZipPath,
        outputDiffZipInfoPath: `${outputZipPath}.info`,
        outputDiffManifestInfoPath: path.join(
          tmpRoot,
          `${appType}.diff-manifest.json.info`,
        ),
        execFileSyncImpl: (_cmd, args, opts) => {
          mockCopyUnzip(opts.cwd, args[2]);
        },
      });

      // Also test when main.jsbundle.hbc itself is in reusedFiles (unchanged from 6.8.0 built-in)!
      const reconstructedDir = path.join(
        tmpRoot,
        'onekey-bundle/6.8.0-7701201',
      );
      const reconstructResult = reconstructFromDiffBundle({
        appType,
        appVersion: '6.8.0',
        bundleVersion: '7701201',
        diffExtractedDir: `${outputZipPath}.extracted`,
        outputDir: reconstructedDir,
        candidateOtaDirs: [],
        builtinDir,
      });

      assert.equal(
        reconstructResult.reconstructedFilesCount,
        Object.keys(targetFiles).length,
      );

      // Verify reconstructed directory is 100% file-for-file & byte-for-byte identical to targetBundleDir!
      assert.deepEqual(
        collectDirectoryFiles(reconstructedDir),
        collectDirectoryFiles(targetBundleDir),
      );
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }
});

test('End-to-End Reconstruction (iOS & Android): reuses built-in main.jsbundle / index.android.bundle when main.jsbundle.hbc is unchanged', () => {
  for (const appType of ['ios', 'android']) {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), `ota-e2e-main-reused-${appType}-`),
    );
    try {
      const baseFiles = {
        'common.bundle': 'common-v680',
        'main.jsbundle.hbc': 'main-unchanged-v680',
        'background.bundle': 'bg-v680',
        'segments/seg_a.seg.hbc': 'seg-a-v680',
      };
      const targetFiles = {
        ...baseFiles,
        'segments/seg_a.seg.hbc': 'seg-a-v680-hotfix',
      };

      const buildMetadata = (files) => {
        const meta = {
          storageSchemaVersion: 'mmkv-v1',
        };
        for (const [k, content] of Object.entries(files)) {
          meta[k] = hashHex(content, 'sha256');
        }
        return meta;
      };

      const baseMetadataPath = path.join(tmpRoot, 'base-metadata.json');
      fs.writeFileSync(
        baseMetadataPath,
        JSON.stringify(buildMetadata(baseFiles), null, 2),
      );

      const targetBundleDir = path.join(tmpRoot, 'target');
      writeFiles(targetBundleDir, targetFiles);
      fs.writeFileSync(
        path.join(targetBundleDir, 'metadata.json'),
        JSON.stringify(buildMetadata(targetFiles), null, 2),
      );

      const builtinDir = path.join(tmpRoot, 'builtin');
      writeFiles(builtinDir, {
        'common.bundle': baseFiles['common.bundle'],
        [appType === 'ios' ? 'main.jsbundle' : 'index.android.bundle']:
          baseFiles['main.jsbundle.hbc'],
        'background.bundle': baseFiles['background.bundle'],
        'segments/seg_a.seg.hbc': baseFiles['segments/seg_a.seg.hbc'],
      });

      const outputZipPath = path.join(tmpRoot, `${appType}-diff.zip`);
      generateOtaDiffBundle({
        appType,
        appVersion: '6.8.0',
        buildNumber: '1',
        bundleVersion: '2',
        baseMetadataPath,
        targetBundleDir,
        outputZipPath,
        outputDiffZipInfoPath: `${outputZipPath}.info`,
        outputDiffManifestInfoPath: `${outputZipPath}.manifest.info`,
        execFileSyncImpl: (_cmd, args, opts) => {
          mockCopyUnzip(opts.cwd, args[2]);
        },
      });

      const outputDir = path.join(tmpRoot, 'reconstructed');
      reconstructFromDiffBundle({
        appType,
        appVersion: '6.8.0',
        bundleVersion: '2',
        diffExtractedDir: `${outputZipPath}.extracted`,
        outputDir,
        builtinDir,
      });

      assert.deepEqual(
        collectDirectoryFiles(outputDir),
        collectDirectoryFiles(targetBundleDir),
      );
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }
});

test('End-to-End Reconstruction (Desktop electron): reconstructs build/** with sha512 and matches full bundle 1:1', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-e2e-electron-'));
  try {
    const baseBuildFiles = {
      'index.html': '<html>6.8.0</html>',
      'static/js/main.js': 'console.log("main-6.8.0")',
      'static/js/async/vendor.js': 'console.log("vendor-6.8.0")',
      'static/media/logo.svg': '<svg>logo</svg>',
    };
    const targetBuildFiles = {
      'index.html': '<html>6.8.0-hotfix</html>', // changed
      'static/js/main.js': 'console.log("main-6.8.0-hotfix")', // changed
      'static/js/async/vendor.js': 'console.log("vendor-6.8.0")', // reused
      'static/media/logo.svg': '<svg>logo</svg>', // reused
    };

    const toSha512Metadata = (files) =>
      Object.fromEntries(
        Object.entries(files)
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, hashHex(v, 'sha512')]),
      );

    const baseMetadataPath = path.join(tmpRoot, 'base-metadata.json');
    fs.writeFileSync(
      baseMetadataPath,
      JSON.stringify(toSha512Metadata(baseBuildFiles), null, 2),
    );

    const targetBundleDir = path.join(tmpRoot, 'target-desktop');
    for (const [rel, content] of Object.entries(targetBuildFiles)) {
      writeFiles(path.join(targetBundleDir, 'build'), { [rel]: content });
    }
    fs.writeFileSync(
      path.join(targetBundleDir, 'metadata.json'),
      JSON.stringify(toSha512Metadata(targetBuildFiles), null, 2),
    );

    const builtinDir = path.join(tmpRoot, 'builtin-desktop');
    for (const [rel, content] of Object.entries(baseBuildFiles)) {
      writeFiles(path.join(builtinDir, 'build'), { [rel]: content });
    }

    const outputZipPath = path.join(tmpRoot, 'desktop-diff-bundle.zip');
    generateOtaDiffBundle({
      appType: 'electron',
      appVersion: '6.8.0',
      buildNumber: '2026111801',
      bundleVersion: '7701300',
      baseMetadataPath,
      targetBundleDir,
      outputZipPath,
      outputDiffZipInfoPath: `${outputZipPath}.info`,
      outputDiffManifestInfoPath: `${outputZipPath}.manifest.info`,
      execFileSyncImpl: (_cmd, args, opts) => {
        mockCopyUnzip(opts.cwd, args[2]);
      },
    });

    const reconstructedDir = path.join(tmpRoot, 'reconstructed-desktop');
    reconstructFromDiffBundle({
      appType: 'electron',
      appVersion: '6.8.0',
      bundleVersion: '7701300',
      diffExtractedDir: `${outputZipPath}.extracted`,
      outputDir: reconstructedDir,
      builtinDir,
    });

    assert.deepEqual(
      collectDirectoryFiles(reconstructedDir),
      collectDirectoryFiles(targetBundleDir),
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Special File Locations Catalog (All 6 Cases across iOS, Android, and Desktop): resolves special built-in paths and packages non-preserved files in changedFiles', () => {
  // Case 1 & 2 (iOS): main.jsbundle.hbc -> main.jsbundle, assets/assets/<subpath> -> assets/<subpath>
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths('ios', 'main.jsbundle.hbc'),
    ['main.jsbundle.hbc', 'main.jsbundle'],
  );
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths(
      'ios',
      'assets/assets/node_modules/icon.png',
    ),
    [
      'assets/assets/node_modules/icon.png',
      'assets/node_modules/icon.png',
      'node_modules/icon.png',
    ],
  );

  // Case 3 (iOS & Android): web-embed/<subpath> stays at web-embed/<subpath>
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths('ios', 'web-embed/index.html'),
    ['web-embed/index.html'],
  );
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths('android', 'web-embed/index.html'),
    ['web-embed/index.html'],
  );

  // Case 4 (Android): main.jsbundle.hbc -> index.android.bundle
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths('android', 'main.jsbundle.hbc'),
    ['main.jsbundle.hbc', 'index.android.bundle'],
  );

  // Case 5 (Android): assets/drawable-* and assets/raw/* -> APK res/ lookup + aapt2 non-preserved classification
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths('android', 'assets/raw/notification.mp3'),
    [
      'assets/raw/notification.mp3',
      'raw/notification.mp3',
      'assets/assets/raw/notification.mp3',
      'res/raw/notification.mp3',
      'res/raw-v4/notification.mp3',
    ],
  );
  assert.equal(
    isBuiltinNonPreservedFile('android', 'assets/raw/keep.xml'),
    true,
  );
  assert.equal(
    isBuiltinNonPreservedFile('android', 'assets/drawable-xhdpi/logo.png'),
    true,
  );
  assert.equal(
    isBuiltinNonPreservedFile('android', 'assets/raw/notification.mp3'),
    false,
  );

  // Case 6 (Desktop electron): 7 asar-excluded installer icons & static/bin/** + extraResources bin/bridge lookup
  for (const excludedIcon of ELECTRON_ASAR_EXCLUDED_ICON_PATHS) {
    assert.equal(isBuiltinNonPreservedFile('electron', excludedIcon), true);
  }
  assert.equal(
    isBuiltinNonPreservedFile(
      'electron',
      'static/bin/bridge/mac-arm64/onekeyd',
    ),
    true,
  );
  assert.equal(
    isBuiltinNonPreservedFile('electron', 'static/images/icons/round_icon.png'),
    false,
  );
  assert.deepEqual(
    resolveBuiltinCandidateRelPaths(
      'electron',
      'static/bin/bridge/mac-arm64/onekeyd',
    ),
    ['static/bin/bridge/mac-arm64/onekeyd', 'bin/bridge/onekeyd'],
  );

  // Verify E2E reconstruction for iOS double-nested assets/assets/ against single-level built-in assets/
  const tmpIos = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-special-ios-'));
  try {
    const files = {
      'common.bundle': 'common',
      'main.jsbundle.hbc': 'main',
      'background.bundle': 'bg',
      'assets/assets/packages/icon.png': 'ios-nested-asset',
      'web-embed/index.html': '<html>web-embed</html>',
    };
    const meta = {
      storageSchemaVersion: 'mmkv-v1',
      ...Object.fromEntries(
        Object.entries(files).map(([k, v]) => [k, hashHex(v, 'sha256')]),
      ),
    };
    const baseMetaPath = path.join(tmpIos, 'base.json');
    fs.writeFileSync(baseMetaPath, JSON.stringify(meta, null, 2));
    const targetDir = path.join(tmpIos, 'target');
    writeFiles(targetDir, {
      ...files,
      'background.bundle': 'bg-updated',
    });
    const targetMeta = {
      ...meta,
      'background.bundle': hashHex('bg-updated', 'sha256'),
    };
    fs.writeFileSync(
      path.join(targetDir, 'metadata.json'),
      JSON.stringify(targetMeta, null, 2),
    );

    // Built-in iOS app has `main.jsbundle` (renamed) and single-level `assets/packages/icon.png`!
    const builtinIosDir = path.join(tmpIos, 'builtin-ios');
    writeFiles(builtinIosDir, {
      'common.bundle': 'common',
      'main.jsbundle': 'main',
      'assets/packages/icon.png': 'ios-nested-asset',
      'web-embed/index.html': '<html>web-embed</html>',
    });

    const zipPath = path.join(tmpIos, 'ios-diff.zip');
    generateOtaDiffBundle({
      appType: 'ios',
      appVersion: '6.8.0',
      buildNumber: '1',
      bundleVersion: '2',
      baseMetadataPath: baseMetaPath,
      targetBundleDir: targetDir,
      outputZipPath: zipPath,
      outputDiffZipInfoPath: `${zipPath}.info`,
      outputDiffManifestInfoPath: `${zipPath}.manifest.info`,
      execFileSyncImpl: (_cmd, args, opts) => {
        mockCopyUnzip(opts.cwd, args[2]);
      },
    });

    const outDir = path.join(tmpIos, 'out');
    reconstructFromDiffBundle({
      appType: 'ios',
      appVersion: '6.8.0',
      bundleVersion: '2',
      diffExtractedDir: `${zipPath}.extracted`,
      outputDir: outDir,
      builtinDir: builtinIosDir,
    });
    assert.deepEqual(
      collectDirectoryFiles(outDir),
      collectDirectoryFiles(targetDir),
    );
  } finally {
    fs.rmSync(tmpIos, { recursive: true, force: true });
  }

  // Verify E2E reconstruction for Android when built-in APK has no assets/raw/keep.xml,
  // crunched res/drawable-*, and un-crunched res/raw/notification.mp3
  const tmpAndroid = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ota-special-android-'),
  );
  try {
    const files = {
      'common.bundle': 'common-and',
      'main.jsbundle.hbc': 'main-and',
      'background.bundle': 'bg-and',
      'assets/raw/keep.xml': '<resources tools:keep="@drawable/*"/>',
      'assets/drawable-xhdpi/icon.png': 'uncrunched-png-bytes',
      'assets/raw/notification.mp3': 'mp3-audio-bytes',
      'web-embed/index.html': '<html>android-web-embed</html>',
    };
    const meta = {
      storageSchemaVersion: 'mmkv-v1',
      ...Object.fromEntries(
        Object.entries(files).map(([k, v]) => [k, hashHex(v, 'sha256')]),
      ),
    };
    const baseMetaPath = path.join(tmpAndroid, 'base.json');
    fs.writeFileSync(baseMetaPath, JSON.stringify(meta, null, 2));
    const targetDir = path.join(tmpAndroid, 'target');
    writeFiles(targetDir, files);
    fs.writeFileSync(
      path.join(targetDir, 'metadata.json'),
      JSON.stringify(meta, null, 2),
    );

    // Built-in Android APK has:
    // - `index.android.bundle` instead of `main.jsbundle.hbc`
    // - `res/raw/notification.mp3` instead of `assets/raw/notification.mp3`
    // - NO `assets/raw/keep.xml` (stripped by aapt2)
    // - Crunched `res/drawable-xhdpi-v4/icon.png` (different bytes from uncrunched)
    const builtinAndroidDir = path.join(tmpAndroid, 'builtin-android');
    writeFiles(builtinAndroidDir, {
      'common.bundle': 'common-and',
      'index.android.bundle': 'main-and',
      'background.bundle': 'bg-and',
      'res/raw/notification.mp3': 'mp3-audio-bytes',
      'res/drawable-xhdpi-v4/icon.png': 'aapt2-crunched-different-bytes',
      'web-embed/index.html': '<html>android-web-embed</html>',
    });

    const zipPath = path.join(tmpAndroid, 'android-diff.zip');
    const diffRes = generateOtaDiffBundle({
      appType: 'android',
      appVersion: '6.8.0',
      buildNumber: '1',
      bundleVersion: '2',
      baseMetadataPath: baseMetaPath,
      targetBundleDir: targetDir,
      outputZipPath: zipPath,
      outputDiffZipInfoPath: `${zipPath}.info`,
      outputDiffManifestInfoPath: `${zipPath}.manifest.info`,
      execFileSyncImpl: (_cmd, args, opts) => {
        mockCopyUnzip(opts.cwd, args[2]);
      },
    });

    // keep.xml and drawable PNG must be forced into changedFiles!
    assert.ok('assets/raw/keep.xml' in diffRes.diffManifest.changedFiles);
    assert.ok(
      'assets/drawable-xhdpi/icon.png' in diffRes.diffManifest.changedFiles,
    );
    // raw/notification.mp3 is preserved and found via APK res/raw/notification.mp3!
    assert.ok(
      'assets/raw/notification.mp3' in diffRes.diffManifest.reusedFiles,
    );

    const outDir = path.join(tmpAndroid, 'out');
    reconstructFromDiffBundle({
      appType: 'android',
      appVersion: '6.8.0',
      bundleVersion: '2',
      diffExtractedDir: `${zipPath}.extracted`,
      outputDir: outDir,
      builtinDir: builtinAndroidDir,
    });
    assert.deepEqual(
      collectDirectoryFiles(outDir),
      collectDirectoryFiles(targetDir),
    );
  } finally {
    fs.rmSync(tmpAndroid, { recursive: true, force: true });
  }

  // Verify E2E reconstruction for Desktop when app.asar excludes the 7 installer icons
  // and moves udev rules to process.resourcesPath (extraResources)
  const tmpDesktop = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ota-special-desktop-'),
  );
  try {
    const files = {
      'index.html': '<html>desktop</html>',
      'static/images/icons/dmg.icns': 'dmg-icns-bytes',
      'static/images/icons/icon.icns': 'icon-icns-bytes',
      'static/images/icons/round_icon.png': 'round-icon-bytes',
      'static/udev/99-onekey.rules': 'SUBSYSTEM=="usb"',
    };
    const meta = Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, hashHex(v, 'sha512')]),
    );
    const baseMetaPath = path.join(tmpDesktop, 'base.json');
    fs.writeFileSync(baseMetaPath, JSON.stringify(meta, null, 2));

    const targetDir = path.join(tmpDesktop, 'target');
    writeFiles(path.join(targetDir, 'build'), files);
    fs.writeFileSync(
      path.join(targetDir, 'metadata.json'),
      JSON.stringify(meta, null, 2),
    );

    // Built-in app.asar does NOT contain dmg.icns or icon.icns, and udev rules are in extraResourcesDir
    const builtinAsarDir = path.join(tmpDesktop, 'app.asar');
    writeFiles(path.join(builtinAsarDir, 'build'), {
      'index.html': '<html>desktop</html>',
      'static/images/icons/round_icon.png': 'round-icon-bytes',
    });
    const extraResourcesDir = path.join(tmpDesktop, 'Resources');
    writeFiles(extraResourcesDir, {
      'static/udev/99-onekey.rules': 'SUBSYSTEM=="usb"',
    });

    const zipPath = path.join(tmpDesktop, 'desktop-diff.zip');
    const diffRes = generateOtaDiffBundle({
      appType: 'electron',
      appVersion: '6.8.0',
      buildNumber: '1',
      bundleVersion: '2',
      baseMetadataPath: baseMetaPath,
      targetBundleDir: targetDir,
      outputZipPath: zipPath,
      outputDiffZipInfoPath: `${zipPath}.info`,
      outputDiffManifestInfoPath: `${zipPath}.manifest.info`,
      execFileSyncImpl: (_cmd, args, opts) => {
        mockCopyUnzip(opts.cwd, args[2]);
      },
    });

    assert.ok(
      'static/images/icons/dmg.icns' in diffRes.diffManifest.changedFiles,
    );
    assert.ok(
      'static/images/icons/icon.icns' in diffRes.diffManifest.changedFiles,
    );
    assert.ok(
      'static/images/icons/round_icon.png' in diffRes.diffManifest.reusedFiles,
    );
    assert.ok(
      'static/udev/99-onekey.rules' in diffRes.diffManifest.reusedFiles,
    );

    const outDir = path.join(tmpDesktop, 'out');
    reconstructFromDiffBundle({
      appType: 'electron',
      appVersion: '6.8.0',
      bundleVersion: '2',
      diffExtractedDir: `${zipPath}.extracted`,
      outputDir: outDir,
      builtinDir: builtinAsarDir,
      extraBuiltinDirs: [extraResourcesDir],
    });
    assert.deepEqual(
      collectDirectoryFiles(outDir),
      collectDirectoryFiles(targetDir),
    );
  } finally {
    fs.rmSync(tmpDesktop, { recursive: true, force: true });
  }
});
