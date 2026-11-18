const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  HASH_ALGORITHMS,
  RESERVED_METADATA_KEYS,
  generateOtaDiffBundle,
} = require('../generate-ota-diff-bundle');

const SCRIPT_PATH = path.resolve(__dirname, '../generate-ota-diff-bundle.js');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-diff-test-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeTestFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
}

function hashData(data, algorithm) {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

function listZipEntries(zipPath) {
  const output = execFileSync('unzip', ['-Z1', zipPath], {
    encoding: 'utf8',
  });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .toSorted();
}

function readZipEntry(zipPath, entryName) {
  return execFileSync('unzip', ['-p', zipPath, entryName]);
}

test('generates electron diff bundle with sha512, sorted keys, build/ prefix, and valid .info files', () =>
  withTempDir((tmpDir) => {
    const baseDir = path.join(tmpDir, 'base');
    const targetBundleDir = path.join(tmpDir, 'apps/desktop/bundle');
    const buildDir = path.join(targetBundleDir, 'build');
    const outputDir = path.join(tmpDir, 'apps/desktop/bundle-zip');

    const unchangedJs = Buffer.from('console.log("unchanged");');
    const changedJs = Buffer.from('console.log("v2");');
    const addedCss = Buffer.from('body { color: #000; }');
    const indexHtml = Buffer.from('<html><body>v2</body></html>');

    const baseMetadata = {
      'index.html': hashData('<html><body>v1</body></html>', 'sha512'),
      'static/js/unchanged.js': hashData(unchangedJs, 'sha512'),
      'static/js/main.js': hashData('console.log("v1");', 'sha512'),
      'static/css/removed.css': hashData('body { color: #fff; }', 'sha512'),
    };
    const baseMetadataPath = path.join(baseDir, 'metadata.json');
    const baseRaw = writeTestFile(
      baseMetadataPath,
      JSON.stringify(baseMetadata, null, 2),
    );

    writeTestFile(path.join(buildDir, 'index.html'), indexHtml);
    writeTestFile(path.join(buildDir, 'static/js/unchanged.js'), unchangedJs);
    writeTestFile(path.join(buildDir, 'static/js/main.js'), changedJs);
    writeTestFile(path.join(buildDir, 'static/css/added.css'), addedCss);

    const targetMetadata = {
      'static/js/unchanged.js': hashData(unchangedJs, 'sha512'),
      'static/css/added.css': hashData(addedCss, 'sha512'),
      'index.html': hashData(indexHtml, 'sha512'),
      'static/js/main.js': hashData(changedJs, 'sha512'),
    };
    const targetMetadataPath = path.join(targetBundleDir, 'metadata.json');
    const targetRaw = writeTestFile(
      targetMetadataPath,
      JSON.stringify(targetMetadata, null, 2),
    );

    const outputZipPath = path.join(outputDir, 'electron-diff-bundle.zip');
    const outputDiffZipInfoPath = path.join(
      outputDir,
      'electron-diff-bundle.json.info',
    );
    const outputDiffManifestInfoPath = path.join(
      outputDir,
      'electron.diff-manifest.json.info',
    );
    const outputDiffManifestPath = path.join(outputDir, 'diff-manifest.json');

    const result = generateOtaDiffBundle({
      appType: 'electron',
      appVersion: '6.8.0',
      buildNumber: '2026111801',
      bundleVersion: '9197881',
      baseMetadataPath,
      targetBundleDir,
      outputZipPath,
      outputDiffZipInfoPath,
      outputDiffManifestInfoPath,
      outputDiffManifestPath,
      generatedAt: '2026-11-18T00:00:00.000Z',
    });

    const manifest = result.diffManifest;
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.appType, 'electron');
    assert.equal(manifest.appVersion, '6.8.0');
    assert.equal(manifest.baseAppVersion, '6.8.0');
    assert.equal(manifest.baseMetadataSha256, hashData(baseRaw, 'sha256'));
    assert.equal(manifest.targetBundleVersion, '9197881');
    assert.equal(manifest.targetMetadataSha256, hashData(targetRaw, 'sha256'));
    assert.equal(manifest.hashAlgorithm, HASH_ALGORITHMS.electron);
    assert.deepEqual(Object.keys(manifest.changedFiles), [
      'index.html',
      'static/css/added.css',
      'static/js/main.js',
    ]);
    assert.deepEqual(Object.keys(manifest.reusedFiles), [
      'static/js/unchanged.js',
    ]);
    assert.deepEqual(manifest.deletedFiles, ['static/css/removed.css']);

    const entries = listZipEntries(outputZipPath);
    assert.deepEqual(entries, [
      'build/',
      'build/index.html',
      'build/static/',
      'build/static/css/',
      'build/static/css/added.css',
      'build/static/js/',
      'build/static/js/main.js',
      'diff-manifest.json',
      'metadata.json',
    ]);
    assert.equal(
      entries.includes('build/static/js/unchanged.js'),
      false,
      'reused files must not be packaged into diff zip',
    );

    assert.equal(
      readZipEntry(outputZipPath, 'diff-manifest.json').equals(
        fs.readFileSync(outputDiffManifestPath),
      ),
      true,
    );
    assert.equal(
      readZipEntry(outputZipPath, 'metadata.json').equals(targetRaw),
      true,
    );
    assert.equal(
      readZipEntry(outputZipPath, 'build/static/js/main.js').equals(changedJs),
      true,
    );

    const zipInfo = JSON.parse(fs.readFileSync(outputDiffZipInfoPath, 'utf8'));
    assert.deepEqual(zipInfo, {
      fileName: 'electron-diff-bundle.zip',
      sha256: hashData(fs.readFileSync(outputZipPath), 'sha256'),
      size: fs.statSync(outputZipPath).size,
      generatedAt: '2026-11-18T00:00:00.000Z',
      appType: 'electron',
      appVersion: '6.8.0',
      buildNumber: '2026111801',
      bundleVersion: '9197881',
    });

    const manifestInfo = JSON.parse(
      fs.readFileSync(outputDiffManifestInfoPath, 'utf8'),
    );
    const manifestBytes = fs.readFileSync(outputDiffManifestPath);
    assert.deepEqual(manifestInfo, {
      fileName: 'diff-manifest.json',
      sha256: hashData(manifestBytes, 'sha256'),
      size: manifestBytes.length,
      generatedAt: '2026-11-18T00:00:00.000Z',
      appType: 'electron',
      appVersion: '6.8.0',
      buildNumber: '2026111801',
      bundleVersion: '9197881',
    });
  }));

for (const platform of ['ios', 'android']) {
  test(`generates ${platform} diff bundle with sha256 and filters reserved metadata keys`, () =>
    withTempDir((tmpDir) => {
      const baseMetadataPath = path.join(tmpDir, 'base-metadata.json');
      const targetDistDir = path.join(
        tmpDir,
        `apps/mobile/out-dir-bundle/${platform}/dist`,
      );
      const outputZipDir = path.join(tmpDir, 'apps/mobile/out-dir-bundle-zip');

      const commonBundle = Buffer.from('common-hbc-v1');
      const seg1 = Buffer.from('segment-1-v1');
      const mainHbcV2 = Buffer.from('main-hbc-v2');
      const seg2V2 = Buffer.from('segment-2-v2');

      const baseMetadata = {
        'common.bundle': hashData(commonBundle, 'sha256'),
        'main.jsbundle.hbc': hashData('main-hbc-v1', 'sha256'),
        'segments/1.hbc': hashData(seg1, 'sha256'),
        'segments/legacy.hbc': hashData('legacy-seg', 'sha256'),
        requiresBackgroundBundle: 'true',
        backgroundProtocolVersion: '1',
        requiresCommonBundle: 'true',
        bundleFormat: 'three-bundle',
        storageSchemaVersion: 'mmkv-v1',
      };
      writeTestFile(baseMetadataPath, JSON.stringify(baseMetadata, null, 2));

      writeTestFile(path.join(targetDistDir, 'common.bundle'), commonBundle);
      writeTestFile(path.join(targetDistDir, 'main.jsbundle.hbc'), mainHbcV2);
      writeTestFile(path.join(targetDistDir, 'segments/1.hbc'), seg1);
      writeTestFile(path.join(targetDistDir, 'segments/2.hbc'), seg2V2);

      const targetMetadata = {
        'segments/2.hbc': hashData(seg2V2, 'sha256'),
        'common.bundle': hashData(commonBundle, 'sha256'),
        'main.jsbundle.hbc': hashData(mainHbcV2, 'sha256'),
        'segments/1.hbc': hashData(seg1, 'sha256'),
        requiresBackgroundBundle: 'true',
        backgroundProtocolVersion: '2',
        requiresCommonBundle: 'true',
        bundleFormat: 'three-bundle',
        storageSchemaVersion: 'mmkv-v1',
      };
      writeTestFile(
        path.join(targetDistDir, 'metadata.json'),
        JSON.stringify(targetMetadata, null, 2),
      );

      const outputZipPath = path.join(
        outputZipDir,
        `${platform}-diff-bundle.zip`,
      );
      const outputDiffZipInfoPath = path.join(
        outputZipDir,
        `${platform}-diff-bundle.zip.info`,
      );
      const outputDiffManifestInfoPath = path.join(
        outputZipDir,
        `${platform}.diff-manifest.json.info`,
      );

      const result = generateOtaDiffBundle({
        appType: platform,
        appVersion: '6.8.1',
        baseAppVersion: '6.8.0',
        buildNumber: '2026111802',
        bundleVersion: '9197999',
        baseMetadataPath,
        targetBundleDir: targetDistDir,
        outputZipPath,
        outputDiffZipInfoPath,
        outputDiffManifestInfoPath,
      });

      const manifest = result.diffManifest;
      assert.equal(manifest.appType, platform);
      assert.equal(manifest.appVersion, '6.8.1');
      assert.equal(manifest.baseAppVersion, '6.8.0');
      assert.equal(manifest.hashAlgorithm, 'sha256');
      assert.deepEqual(Object.keys(manifest.changedFiles), [
        'main.jsbundle.hbc',
        'segments/2.hbc',
      ]);
      assert.deepEqual(Object.keys(manifest.reusedFiles), [
        'common.bundle',
        'segments/1.hbc',
      ]);
      assert.deepEqual(manifest.deletedFiles, ['segments/legacy.hbc']);

      for (const reservedKey of RESERVED_METADATA_KEYS) {
        assert.equal(reservedKey in manifest.changedFiles, false);
        assert.equal(reservedKey in manifest.reusedFiles, false);
        assert.equal(manifest.deletedFiles.includes(reservedKey), false);
      }

      const entries = listZipEntries(outputZipPath);
      assert.deepEqual(entries, [
        'diff-manifest.json',
        'main.jsbundle.hbc',
        'metadata.json',
        'segments/',
        'segments/2.hbc',
      ]);
      assert.equal(
        readZipEntry(outputZipPath, 'segments/2.hbc').equals(seg2V2),
        true,
      );

      const zipInfo = JSON.parse(
        fs.readFileSync(outputDiffZipInfoPath, 'utf8'),
      );
      assert.equal(zipInfo.fileName, `${platform}-diff-bundle.zip`);
      assert.equal(zipInfo.appType, platform);

      const manifestInfo = JSON.parse(
        fs.readFileSync(outputDiffManifestInfoPath, 'utf8'),
      );
      assert.equal(manifestInfo.fileName, 'diff-manifest.json');
      assert.equal(manifestInfo.appType, platform);
    }));
}

test('handles identical base and target metadata with zero changed files', () =>
  withTempDir((tmpDir) => {
    const baseMetadataPath = path.join(tmpDir, 'base.json');
    const targetBundleDir = path.join(tmpDir, 'dist');
    const fileHash = hashData('same', 'sha256');

    writeTestFile(
      baseMetadataPath,
      JSON.stringify({ 'common.bundle': fileHash }, null, 2),
    );
    writeTestFile(
      path.join(targetBundleDir, 'metadata.json'),
      JSON.stringify({ 'common.bundle': fileHash }, null, 2),
    );
    writeTestFile(path.join(targetBundleDir, 'common.bundle'), 'same');

    const outputZipPath = path.join(tmpDir, 'out/ios-diff-bundle.zip');
    const result = generateOtaDiffBundle({
      appType: 'ios',
      appVersion: '6.8.0',
      buildNumber: '1',
      bundleVersion: '100',
      baseMetadataPath,
      targetBundleDir,
      outputZipPath,
      outputDiffZipInfoPath: path.join(tmpDir, 'out/ios-diff-bundle.zip.info'),
      outputDiffManifestInfoPath: path.join(
        tmpDir,
        'out/ios.diff-manifest.json.info',
      ),
    });

    assert.deepEqual(result.diffManifest.changedFiles, {});
    assert.deepEqual(result.diffManifest.deletedFiles, []);
    assert.deepEqual(result.diffManifest.reusedFiles, {
      'common.bundle': fileHash,
    });
    assert.deepEqual(listZipEntries(outputZipPath), [
      'diff-manifest.json',
      'metadata.json',
    ]);
  }));

test('throws descriptive error when a changed file is missing from targetBundleDir', () =>
  withTempDir((tmpDir) => {
    const baseMetadataPath = path.join(tmpDir, 'base.json');
    const targetBundleDir = path.join(tmpDir, 'bundle');

    writeTestFile(baseMetadataPath, JSON.stringify({}, null, 2));
    writeTestFile(
      path.join(targetBundleDir, 'metadata.json'),
      JSON.stringify({ 'static/missing.js': 'abc123' }, null, 2),
    );

    assert.throws(
      () =>
        generateOtaDiffBundle({
          appType: 'electron',
          appVersion: '6.8.0',
          buildNumber: '1',
          bundleVersion: '100',
          baseMetadataPath,
          targetBundleDir,
          outputZipPath: path.join(tmpDir, 'out/diff.zip'),
          outputDiffZipInfoPath: path.join(tmpDir, 'out/diff.json.info'),
          outputDiffManifestInfoPath: path.join(
            tmpDir,
            'out/diff-manifest.json.info',
          ),
        }),
      /Missing changed file for electron diff bundle/,
    );
  }));

test('rejects path traversal entries in metadata.json', () =>
  withTempDir((tmpDir) => {
    const baseMetadataPath = path.join(tmpDir, 'base.json');
    const targetBundleDir = path.join(tmpDir, 'dist');

    writeTestFile(baseMetadataPath, JSON.stringify({}, null, 2));
    writeTestFile(
      path.join(targetBundleDir, 'metadata.json'),
      JSON.stringify({ '../evil.js': 'deadbeef' }, null, 2),
    );

    assert.throws(
      () =>
        generateOtaDiffBundle({
          appType: 'android',
          appVersion: '6.8.0',
          buildNumber: '1',
          bundleVersion: '100',
          baseMetadataPath,
          targetBundleDir,
          outputZipPath: path.join(tmpDir, 'out/diff.zip'),
          outputDiffZipInfoPath: path.join(tmpDir, 'out/diff.zip.info'),
          outputDiffManifestInfoPath: path.join(
            tmpDir,
            'out/diff-manifest.json.info',
          ),
        }),
      /path traversal/i,
    );
  }));

test('works when invoked as a CLI script', () =>
  withTempDir((tmpDir) => {
    const baseMetadataPath = path.join(tmpDir, 'base.json');
    const targetBundleDir = path.join(tmpDir, 'dist');
    const outputZipPath = path.join(tmpDir, 'zip/android-diff-bundle.zip');
    const outputDiffZipInfoPath = path.join(
      tmpDir,
      'zip/android-diff-bundle.zip.info',
    );
    const outputDiffManifestInfoPath = path.join(
      tmpDir,
      'zip/android.diff-manifest.json.info',
    );

    writeTestFile(baseMetadataPath, JSON.stringify({ 'a.js': '111' }, null, 2));
    writeTestFile(
      path.join(targetBundleDir, 'metadata.json'),
      JSON.stringify({ 'a.js': '222' }, null, 2),
    );
    writeTestFile(path.join(targetBundleDir, 'a.js'), 'new-a');

    const stdout = execFileSync(
      process.execPath,
      [
        SCRIPT_PATH,
        '--app-type',
        'android',
        '--app-version=6.8.0',
        '--build-number',
        '2026111805',
        '--bundle-version',
        '9198000',
        '--base-metadata-path',
        baseMetadataPath,
        '--target-bundle-dir',
        targetBundleDir,
        '--output-zip-path',
        outputZipPath,
        '--output-diff-zip-info-path',
        outputDiffZipInfoPath,
        '--output-diff-manifest-info-path',
        outputDiffManifestInfoPath,
      ],
      { encoding: 'utf8' },
    );

    assert.match(stdout, /Generated OTA diff bundle \(android\): changed=1/);
    assert.equal(fs.existsSync(outputZipPath), true);
    assert.equal(fs.existsSync(outputDiffZipInfoPath), true);
    assert.equal(fs.existsSync(outputDiffManifestInfoPath), true);
  }));
