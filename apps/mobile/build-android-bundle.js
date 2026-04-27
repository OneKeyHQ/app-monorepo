/* eslint-disable onekey/no-raw-error */
/* cspell:ignore debugid */
const { execSync } = require('child_process');
const path = require('path');

const fs = require('fs-extra');

const {
  HERMES_COMMAND,
  assertSplitBundleOutputs,
  backgroundProtocolVersion,
  buildAndroidOutputAssetPath,
  buildBackgroundBundle,
  buildSegments,
  buildWebEmbed,
  buildZipOutputAssetPath,
  cleanBundleOutput,
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
  uploadSourceMapsToSentry,
  useUnionBuild,
  webEmbedOutputPath,
} = require('./build-bundle-base');

const buildAndroidBundle = async () => {
  log('build android bundle start');
  ensureSplitBundleBuildEnv();
  ensureBundleOutputPath();
  ensureZipOutputPath();

  if (useUnionBuild) {
    runUnionBuild({
      platform: 'android',
      mainBundleOutput: buildAndroidOutputAssetPath('main.jsbundle'),
      mainSourceMapOutput: buildAndroidOutputAssetPath('main.jsbundle.map'),
      commonBundleOutput: buildAndroidOutputAssetPath('common.jsbundle'),
      commonSourceMapOutput: buildAndroidOutputAssetPath('common.jsbundle.map'),
      backgroundBundleOutput: buildAndroidOutputAssetPath(
        'background.bundle.js',
      ),
      backgroundSourceMapOutput: buildAndroidOutputAssetPath(
        'background.bundle.packager.map',
      ),
      assetsDest: buildAndroidOutputAssetPath('assets'),
    });
  } else {
    runReactNativeBundle({
      platform: 'android',
      entryFile: indexFilePath,
      assetsDest: buildAndroidOutputAssetPath('assets'),
      bundleOutput: buildAndroidOutputAssetPath('main.jsbundle'),
      sourceMapOutput: buildAndroidOutputAssetPath('main.jsbundle.map'),
      runtimeTarget: 'main',
    });
    log('build android bundle done');
  }
  assertSplitBundleOutputs({
    runtimeTarget: 'main',
    bundlePath: buildAndroidOutputAssetPath('main.jsbundle'),
  });

  log('build android bundle compress to hbc');
  execSync(
    `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${buildAndroidOutputAssetPath(
      'main.jsbundle.hbc',
    )} ${buildAndroidOutputAssetPath('main.jsbundle')}`,
    {
      stdio: 'inherit',
    },
  );
  log('build android bundle compress to hbc done');

  log('build android main bundle: rename packager source map');
  fs.moveSync(
    buildAndroidOutputAssetPath('main.jsbundle.map'),
    buildAndroidOutputAssetPath('main.jsbundle.packager.map'),
  );

  composeSourceMaps({
    packagerMapPath: buildAndroidOutputAssetPath('main.jsbundle.packager.map'),
    hermesMapPath: buildAndroidOutputAssetPath('main.jsbundle.hbc.map'),
    outputPath: buildAndroidOutputAssetPath('main.jsbundle.map'),
    label: 'build android main bundle',
  });
  copyDebugIdToSourceMap({
    packagerMapPath: buildAndroidOutputAssetPath('main.jsbundle.packager.map'),
    sourceMapPath: buildAndroidOutputAssetPath('main.jsbundle.map'),
    label: 'build android main bundle',
  });
  fs.rmSync(buildAndroidOutputAssetPath('main.jsbundle.packager.map'));

  uploadSourceMapsToSentry({
    bundlePath: buildAndroidOutputAssetPath('main.jsbundle.hbc'),
    sourceMapPath: buildAndroidOutputAssetPath('main.jsbundle.map'),
    label: 'build android main bundle',
  });

  // --- Common bundle hermesc compilation (union build only) ---
  if (useUnionBuild) {
    const commonBundleJsPath = buildAndroidOutputAssetPath('common.jsbundle');
    const commonBundleHbcPath = buildAndroidOutputAssetPath(
      'common.jsbundle.hbc',
    );
    const commonBundlePackagerMapPath = buildAndroidOutputAssetPath(
      'common.jsbundle.packager.map',
    );
    const commonBundleMapPath = buildAndroidOutputAssetPath(
      'common.jsbundle.map',
    );

    log('build android common bundle compress to hbc');
    execSync(
      `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${commonBundleHbcPath} ${commonBundleJsPath}`,
      { stdio: 'inherit' },
    );
    log('build android common bundle compress to hbc done');

    // The union build writes the source map directly to common.jsbundle.map;
    // rename it to .packager.map so we can compose with the hermesc map.
    fs.moveSync(commonBundleMapPath, commonBundlePackagerMapPath);

    composeSourceMaps({
      packagerMapPath: commonBundlePackagerMapPath,
      hermesMapPath: `${commonBundleHbcPath}.map`,
      outputPath: commonBundleMapPath,
      label: 'build android common bundle',
    });
    copyDebugIdToSourceMap({
      packagerMapPath: commonBundlePackagerMapPath,
      sourceMapPath: commonBundleMapPath,
      label: 'build android common bundle',
    });

    uploadSourceMapsToSentry({
      bundlePath: commonBundleHbcPath,
      sourceMapPath: commonBundleMapPath,
      label: 'build android common bundle',
    });

    fs.rmSync(commonBundleJsPath, { force: true });
    fs.rmSync(commonBundlePackagerMapPath, { force: true });
    fs.rmSync(`${commonBundleHbcPath}.map`, { force: true });
  }

  if (!useUnionBuild) {
    await buildBackgroundBundle({
      platform: 'android',
      buildOutputAssetPath: buildAndroidOutputAssetPath,
      assetsOutputPath: buildAndroidOutputAssetPath('assets'),
    });
  } else {
    assertSplitBundleOutputs({
      runtimeTarget: 'background',
      bundlePath: buildAndroidOutputAssetPath('background.bundle.js'),
    });

    const backgroundBundleJsPath = buildAndroidOutputAssetPath(
      'background.bundle.js',
    );
    const backgroundBundleHbcPath = buildAndroidOutputAssetPath(
      'background.bundle.hbc',
    );
    const backgroundBundlePath =
      buildAndroidOutputAssetPath('background.bundle');
    const backgroundBundlePackagerMapPath = buildAndroidOutputAssetPath(
      'background.bundle.packager.map',
    );
    const backgroundBundleMapPath = buildAndroidOutputAssetPath(
      'background.bundle.map',
    );

    log('build android background bundle compress to hbc');
    execSync(
      `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${backgroundBundleHbcPath} ${backgroundBundleJsPath}`,
      { stdio: 'inherit' },
    );
    log('build android background bundle compress to hbc done');

    composeSourceMaps({
      packagerMapPath: backgroundBundlePackagerMapPath,
      hermesMapPath: `${backgroundBundleHbcPath}.map`,
      outputPath: backgroundBundleMapPath,
      label: 'build android background bundle',
    });
    copyDebugIdToSourceMap({
      packagerMapPath: backgroundBundlePackagerMapPath,
      sourceMapPath: backgroundBundleMapPath,
      label: 'build android background bundle',
    });

    fs.moveSync(backgroundBundleHbcPath, backgroundBundlePath, {
      overwrite: true,
    });
    uploadSourceMapsToSentry({
      bundlePath: backgroundBundlePath,
      sourceMapPath: backgroundBundleMapPath,
      label: 'build android background bundle',
    });

    fs.rmSync(backgroundBundleJsPath, { force: true });
    fs.rmSync(backgroundBundlePackagerMapPath, { force: true });
    fs.rmSync(`${backgroundBundleHbcPath}.map`, { force: true });
  }

  await buildSegments({
    platform: 'android',
    buildOutputAssetPath: buildAndroidOutputAssetPath,
  });

  // Build background segments (Phase 3)
  await buildSegments({
    platform: 'android',
    buildOutputAssetPath: buildAndroidOutputAssetPath,
    inputDir: getSegmentsDir('background'),
    outputSubdir: 'segments-background',
  });

  const distPath = buildAndroidOutputAssetPath('dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath);
  }
  fs.moveSync(
    buildAndroidOutputAssetPath('assets'),
    buildAndroidOutputAssetPath('dist/assets'),
  );
  fs.moveSync(
    buildAndroidOutputAssetPath('main.jsbundle.hbc'),
    buildAndroidOutputAssetPath('dist/main.jsbundle.hbc'),
  );
  // Move common bundle into dist if it exists (union build).
  // Rename to "common.bundle" to match the filename the native loader
  // (BundleUpdateStoreAndroid / ExpoReactHostFactory sequential file loader /
  // BackgroundThreadManager) looks for on disk — see docs/ota-three-bundle.md.
  const androidCommonBundleHbc = buildAndroidOutputAssetPath(
    'common.jsbundle.hbc',
  );
  if (fs.existsSync(androidCommonBundleHbc)) {
    fs.moveSync(
      androidCommonBundleHbc,
      buildAndroidOutputAssetPath('dist/common.bundle'),
    );
  }
  fs.moveSync(
    buildAndroidOutputAssetPath('background.bundle'),
    buildAndroidOutputAssetPath('dist/background.bundle'),
  );
  // Move segments into dist if they exist
  const androidSegmentsDir = buildAndroidOutputAssetPath('segments');
  if (fs.existsSync(androidSegmentsDir)) {
    fs.moveSync(
      androidSegmentsDir,
      buildAndroidOutputAssetPath('dist/segments'),
    );
  }
  const androidSegmentsBgDir = buildAndroidOutputAssetPath(
    'segments-background',
  );
  if (fs.existsSync(androidSegmentsBgDir)) {
    fs.moveSync(
      androidSegmentsBgDir,
      buildAndroidOutputAssetPath('dist/segments-background'),
    );
  }

  const webEmbedAndroidPath = path.join(distPath, 'web-embed');
  if (!fs.existsSync(webEmbedAndroidPath)) {
    fs.mkdirSync(webEmbedAndroidPath, { recursive: true });
  }
  execSync(`rsync -r -c -v ${webEmbedOutputPath}/ ${webEmbedAndroidPath}/`, {
    stdio: 'inherit',
  });
  copyModuleIdMapToPlatformDist(distPath);

  log('build android bundle compress dist to zip');
  generateMetadataJson(distPath, {
    requiresBackgroundBundle: 'true',
    backgroundProtocolVersion,
  });
  execSync(`cd ${distPath} && zip -r dist.zip .`, {
    stdio: 'inherit',
  });

  const zipFilePath = buildZipOutputAssetPath('android-bundle.zip');
  fs.moveSync(buildAndroidOutputAssetPath('dist/dist.zip'), zipFilePath);
  generateFileInfo(zipFilePath, undefined, 'android');
  generateFileInfo(
    buildAndroidOutputAssetPath('dist/metadata.json'),
    buildZipOutputAssetPath('android.metadata.json.info'),
    'android',
  );
  log('build android bundle compress dist to zip done');
  log('build android bundle done');
};

const main = async () => {
  await cleanBundleOutput({ platform: 'android' });
  await buildWebEmbed();
  await buildAndroidBundle();
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildAndroidBundle };
