/* eslint-disable onekey/no-raw-error */
/* cspell:ignore debugid */
const { execSync } = require('child_process');
const path = require('path');

const fs = require('fs-extra');

const {
  HERMES_COMMAND,
  assertSplitBundleOutputs,
  backgroundProtocolVersion,
  buildBackgroundBundle,
  buildIOSOutputAssetPath,
  buildSegments,
  buildWebEmbed,
  buildZipOutputAssetPath,
  cleanBundleOutput,
  cleanupSourceMapsUnder,
  composeSourceMaps,
  copyDebugIdToSourceMap,
  copyModuleIdMapToPlatformDist,
  ensureBundleOutputPath,
  ensureSplitBundleBuildEnv,
  ensureZipOutputPath,
  generateFileInfo,
  generateMetadataJson,
  getSegmentsDir,
  indexFilePath,
  log,
  runReactNativeBundle,
  runUnionBuild,
  uploadDirectoryToSentry,
  useUnionBuild,
  webEmbedOutputPath,
} = require('./build-bundle-base');

const buildIOSBundle = async () => {
  log('build ios bundle start');
  ensureSplitBundleBuildEnv();
  ensureBundleOutputPath();
  ensureZipOutputPath();

  if (useUnionBuild) {
    runUnionBuild({
      platform: 'ios',
      mainBundleOutput: buildIOSOutputAssetPath('main.jsbundle'),
      mainSourceMapOutput: buildIOSOutputAssetPath('main.jsbundle.map'),
      commonBundleOutput: buildIOSOutputAssetPath('common.jsbundle'),
      commonSourceMapOutput: buildIOSOutputAssetPath('common.jsbundle.map'),
      backgroundBundleOutput: buildIOSOutputAssetPath('background.bundle.js'),
      backgroundSourceMapOutput: buildIOSOutputAssetPath(
        'background.bundle.packager.map',
      ),
      assetsDest: buildIOSOutputAssetPath('assets'),
    });
  } else {
    runReactNativeBundle({
      platform: 'ios',
      entryFile: indexFilePath,
      assetsDest: buildIOSOutputAssetPath('assets'),
      bundleOutput: buildIOSOutputAssetPath('main.jsbundle'),
      sourceMapOutput: buildIOSOutputAssetPath('main.jsbundle.map'),
      runtimeTarget: 'main',
    });
    log('build ios bundle done');
  }
  assertSplitBundleOutputs({
    runtimeTarget: 'main',
    bundlePath: buildIOSOutputAssetPath('main.jsbundle'),
  });

  log('build ios bundle hbc');
  execSync(
    `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${buildIOSOutputAssetPath(
      'main.jsbundle.hbc',
    )} ${buildIOSOutputAssetPath('main.jsbundle')}`,
    { stdio: 'inherit' },
  );
  log('build ios bundle hbc done');

  log('build ios main bundle: rename packager source map');
  fs.moveSync(
    buildIOSOutputAssetPath('main.jsbundle.map'),
    buildIOSOutputAssetPath('main.jsbundle.packager.map'),
  );

  composeSourceMaps({
    packagerMapPath: buildIOSOutputAssetPath('main.jsbundle.packager.map'),
    hermesMapPath: buildIOSOutputAssetPath('main.jsbundle.hbc.map'),
    outputPath: buildIOSOutputAssetPath('main.jsbundle.map'),
    label: 'build ios main bundle',
  });
  copyDebugIdToSourceMap({
    packagerMapPath: buildIOSOutputAssetPath('main.jsbundle.packager.map'),
    sourceMapPath: buildIOSOutputAssetPath('main.jsbundle.map'),
    label: 'build ios main bundle',
  });
  fs.rmSync(buildIOSOutputAssetPath('main.jsbundle.packager.map'));
  // Drop the raw hermesc intermediate map so it doesn't get uploaded by the
  // batch sentry-cli walk below — only the composed map is the one we want
  // Sentry to pair with main.jsbundle.hbc. Mirrors common/background paths.
  fs.rmSync(buildIOSOutputAssetPath('main.jsbundle.hbc.map'), { force: true });
  // main.jsbundle sourcemap upload is deferred to the batch upload below
  // (uploadDirectoryToSentry) so all bundles + segments ship in ONE HTTP
  // round-trip instead of N per-file uploads.

  // --- Common bundle hermesc compilation (union build only) ---
  if (useUnionBuild) {
    const commonBundleJsPath = buildIOSOutputAssetPath('common.jsbundle');
    const commonBundleHbcPath = buildIOSOutputAssetPath('common.jsbundle.hbc');
    const commonBundlePackagerMapPath = buildIOSOutputAssetPath(
      'common.jsbundle.packager.map',
    );
    const commonBundleMapPath = buildIOSOutputAssetPath('common.jsbundle.map');

    log('build ios common bundle compress to hbc');
    execSync(
      `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${commonBundleHbcPath} ${commonBundleJsPath}`,
      { stdio: 'inherit' },
    );
    log('build ios common bundle compress to hbc done');

    // The union build writes the source map directly to common.jsbundle.map;
    // rename it to .packager.map so we can compose with the hermesc map.
    fs.moveSync(commonBundleMapPath, commonBundlePackagerMapPath);

    composeSourceMaps({
      packagerMapPath: commonBundlePackagerMapPath,
      hermesMapPath: `${commonBundleHbcPath}.map`,
      outputPath: commonBundleMapPath,
      label: 'build ios common bundle',
    });
    copyDebugIdToSourceMap({
      packagerMapPath: commonBundlePackagerMapPath,
      sourceMapPath: commonBundleMapPath,
      label: 'build ios common bundle',
    });
    // common bundle sourcemap upload is deferred to the batch upload below.

    // Keep raw JS for debugging module ID issues
    // fs.rmSync(commonBundleJsPath, { force: true });
    fs.rmSync(commonBundlePackagerMapPath, { force: true });
    fs.rmSync(`${commonBundleHbcPath}.map`, { force: true });
  }

  if (!useUnionBuild) {
    await buildBackgroundBundle({
      platform: 'ios',
      buildOutputAssetPath: buildIOSOutputAssetPath,
      assetsOutputPath: buildIOSOutputAssetPath('assets'),
    });
  } else {
    assertSplitBundleOutputs({
      runtimeTarget: 'background',
      bundlePath: buildIOSOutputAssetPath('background.bundle.js'),
    });

    const backgroundBundleJsPath = buildIOSOutputAssetPath(
      'background.bundle.js',
    );
    const backgroundBundleHbcPath = buildIOSOutputAssetPath(
      'background.bundle.hbc',
    );
    const backgroundBundlePath = buildIOSOutputAssetPath('background.bundle');
    const backgroundBundlePackagerMapPath = buildIOSOutputAssetPath(
      'background.bundle.packager.map',
    );
    const backgroundBundleMapPath = buildIOSOutputAssetPath(
      'background.bundle.map',
    );

    log('build ios background bundle compress to hbc');
    execSync(
      `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${backgroundBundleHbcPath} ${backgroundBundleJsPath}`,
      { stdio: 'inherit' },
    );
    log('build ios background bundle compress to hbc done');

    composeSourceMaps({
      packagerMapPath: backgroundBundlePackagerMapPath,
      hermesMapPath: `${backgroundBundleHbcPath}.map`,
      outputPath: backgroundBundleMapPath,
      label: 'build ios background bundle',
    });
    copyDebugIdToSourceMap({
      packagerMapPath: backgroundBundlePackagerMapPath,
      sourceMapPath: backgroundBundleMapPath,
      label: 'build ios background bundle',
    });

    fs.moveSync(backgroundBundleHbcPath, backgroundBundlePath, {
      overwrite: true,
    });
    // background bundle sourcemap upload is deferred to the batch upload below.

    // Keep raw JS for debugging module ID issues
    // fs.rmSync(backgroundBundleJsPath, { force: true });
    fs.rmSync(backgroundBundlePackagerMapPath, { force: true });
    fs.rmSync(`${backgroundBundleHbcPath}.map`, { force: true });
  }

  await buildSegments({
    platform: 'ios',
    buildOutputAssetPath: buildIOSOutputAssetPath,
  });

  // Build background segments (Phase 3)
  await buildSegments({
    platform: 'ios',
    buildOutputAssetPath: buildIOSOutputAssetPath,
    inputDir: getSegmentsDir('background'),
    outputSubdir: 'segments-background',
  });

  // Single batch upload of every .hbc/.bundle/.jsbundle + sibling .map under
  // the platform output dir. Replaces what was previously O(N) per-segment
  // sentry-cli calls (~1.6s each × 2200 segments). Sentry CLI walks the tree,
  // pairs scripts with their maps, and ships everything as one artifact bundle.
  uploadDirectoryToSentry({
    directory: buildIOSOutputAssetPath(''),
    label: 'build ios bundle batch',
  });
  // Sourcemaps already uploaded — sweep them off disk so they don't get
  // moved into dist/segments / dist/segments-background and shipped inside
  // the OTA zip.
  cleanupSourceMapsUnder(buildIOSOutputAssetPath(''));

  const distPath = buildIOSOutputAssetPath('dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
  }
  fs.moveSync(
    buildIOSOutputAssetPath('assets'),
    buildIOSOutputAssetPath('dist/assets'),
  );
  fs.moveSync(
    buildIOSOutputAssetPath('main.jsbundle.hbc'),
    buildIOSOutputAssetPath('dist/main.jsbundle.hbc'),
  );
  // Move common bundle into dist if it exists (union build).
  // Rename to "common.bundle" to match the filename the native loader
  // (BundleUpdateStore / SplitBundle two-step loader) looks for on disk —
  // see docs/ota-three-bundle.md.
  const iosCommonBundleHbc = buildIOSOutputAssetPath('common.jsbundle.hbc');
  if (fs.existsSync(iosCommonBundleHbc)) {
    fs.moveSync(
      iosCommonBundleHbc,
      buildIOSOutputAssetPath('dist/common.bundle'),
    );
  }
  fs.moveSync(
    buildIOSOutputAssetPath('background.bundle'),
    buildIOSOutputAssetPath('dist/background.bundle'),
  );
  // Move segments into dist if they exist
  const iosSegmentsDir = buildIOSOutputAssetPath('segments');
  if (fs.existsSync(iosSegmentsDir)) {
    fs.moveSync(iosSegmentsDir, buildIOSOutputAssetPath('dist/segments'));
  }
  const iosSegmentsBgDir = buildIOSOutputAssetPath('segments-background');
  if (fs.existsSync(iosSegmentsBgDir)) {
    fs.moveSync(
      iosSegmentsBgDir,
      buildIOSOutputAssetPath('dist/segments-background'),
    );
  }
  log('build ios bundle compress dist to zip');

  const webEmbedIOSPath = path.join(distPath, 'web-embed');
  if (!fs.existsSync(webEmbedIOSPath)) {
    fs.mkdirSync(webEmbedIOSPath, { recursive: true });
  }
  execSync(`rsync -r -c -v ${webEmbedOutputPath}/ ${webEmbedIOSPath}/`, {
    stdio: 'inherit',
  });
  copyModuleIdMapToPlatformDist(distPath);
  generateMetadataJson(distPath, {
    requiresBackgroundBundle: 'true',
    backgroundProtocolVersion,
  });
  execSync(`cd ${distPath} && zip -r dist.zip .`, {
    stdio: 'inherit',
  });

  const zipFilePath = buildZipOutputAssetPath('ios-bundle.zip');
  fs.moveSync(buildIOSOutputAssetPath('dist/dist.zip'), zipFilePath);
  generateFileInfo(zipFilePath, undefined, 'ios');
  generateFileInfo(
    buildIOSOutputAssetPath('dist/metadata.json'),
    buildZipOutputAssetPath('ios.metadata.json.info'),
    'ios',
  );
  log('build ios bundle compress dist to zip done');
  log('build ios bundle done');
};

const main = async () => {
  await cleanBundleOutput({ platform: 'ios' });
  await buildWebEmbed();
  await buildIOSBundle();
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildIOSBundle };
