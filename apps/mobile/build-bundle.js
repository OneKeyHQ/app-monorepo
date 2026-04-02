require('../../development/env');

const { execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const fs = require('fs-extra');

const {
  SEGMENTS_INPUT_DIR,
  getSegmentsDir,
  getManifestPath,
} = require('./plugins/segmentPaths');

const mobileDirPath = __dirname;
const projectRootPath = path.join(mobileDirPath, '../..');
const indexFilePath = path.join(mobileDirPath, 'index.ts');
const backgroundIndexFilePath = path.join(mobileDirPath, 'background.ts');
const bundleOutputPath = path.join(mobileDirPath, 'out-dir-bundle');
const zipOutputPath = path.join(mobileDirPath, 'out-dir-bundle-zip');
const backgroundProtocolVersion = '1';
const useUnionBuild = process.env.UNION_BUILD === 'true';
const enableNativeBackgroundThread =
  process.env.ENABLE_NATIVE_BACKGROUND_THREAD === 'true';

if (enableNativeBackgroundThread) {
  process.env.ONEKEY_PLATFORM = process.env.ONEKEY_PLATFORM || 'app';
  process.env.SPLIT_BUNDLE = process.env.SPLIT_BUNDLE || '1';
  process.env.SPLIT_BUNDLE_SEGMENTS =
    process.env.SPLIT_BUNDLE_SEGMENTS || 'true';
}

const SENTRY_ORG = 'onekey-bb';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_TOKEN;

const HERMES_PLATFORM_DIR =
  process.platform === 'linux' ? 'linux64-bin' : 'osx-bin';
// cspell:ignore hermesc
const HERMES_COMMAND = path.join(
  projectRootPath,
  `node_modules/react-native/sdks/hermesc/${HERMES_PLATFORM_DIR}/hermesc`,
);

const webEmbedOutputPath = path.join(
  projectRootPath,
  'apps/web-embed/web-build',
);

const log = (...messages) => {
  console.log(`>>>> ${messages.join(' ')}`);
};

const buildZipOutputAssetPath = (zipName) => {
  return path.join(zipOutputPath, zipName);
};

const buildIOSOutputAssetPath = (assetName) => {
  return path.join(bundleOutputPath, 'ios', assetName);
};

const buildAndroidOutputAssetPath = (assetName) => {
  return path.join(bundleOutputPath, 'android', assetName);
};

const cleanBundleOutput = async () => {
  fs.rmSync(webEmbedOutputPath, { recursive: true, force: true });
  fs.rmSync(bundleOutputPath, { recursive: true, force: true });
  fs.rmSync(zipOutputPath, { recursive: true, force: true });
  fs.rmSync(getSegmentsDir('main'), { recursive: true, force: true });
  fs.rmSync(getSegmentsDir('background'), { recursive: true, force: true });
  fs.rmSync(getManifestPath('main'), { force: true });
  fs.rmSync(getManifestPath('background'), { force: true });
  fs.rmSync(path.join(mobileDirPath, 'dist/allocation-report-main.json'), {
    force: true,
  });
  fs.rmSync(
    path.join(mobileDirPath, 'dist/allocation-report-background.json'),
    {
      force: true,
    },
  );
};

const ensureBundleOutputPath = async () => {
  if (!fs.existsSync(bundleOutputPath)) {
    fs.mkdirSync(bundleOutputPath, { recursive: true });
  }
};

const ensureZipOutputPath = async () => {
  if (!fs.existsSync(zipOutputPath)) {
    fs.mkdirSync(zipOutputPath, { recursive: true });
  }
};

// Get the Node.js executable path
const nodeExecutablePath = process.execPath;
console.log(`Node.js executable path: ${nodeExecutablePath}`);

const ignoreFiles = ['.DS_Store'];

const shouldIgnoreFile = (fileName) => {
  return ignoreFiles.some((pattern) => {
    return fileName.endsWith(pattern);
  });
};

const generateMetadataJson = async (dirPath, extraMetadata = {}) => {
  const metadata = {};

  const traverseDirectory = (currentPath) => {
    const items = fs.readdirSync(currentPath);

    items.forEach((item) => {
      const itemPath = path.join(currentPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isFile() && !shouldIgnoreFile(item)) {
        try {
          const fileContent = fs.readFileSync(itemPath);
          const hash = crypto
            .createHash('sha256')
            .update(fileContent)
            .digest('hex');

          // Use relative path from the base directory as the key
          const relativePath = path.relative(dirPath, itemPath);
          metadata[relativePath] = hash;
        } catch (error) {
          console.warn(`Failed to hash file ${itemPath}:`, error.message);
        }
      } else if (stat.isDirectory()) {
        traverseDirectory(itemPath);
      }
    });
  };

  if (fs.existsSync(dirPath)) {
    traverseDirectory(dirPath);

    Object.entries(extraMetadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        metadata[key] = `${value}`;
      }
    });

    // MetadataV2: embed segment manifest data (Phase 6)
    // Merge segment entries from both main and background manifests.
    // This adds runtimeGraphVersion, mainEntry, backgroundEntry, and segments
    // while preserving v1 backward compatibility (flat file→hash entries).
    const mainManifestPath = getManifestPath('main');
    const bgManifestPath = getManifestPath('background');
    const allSegments = {};

    [mainManifestPath, bgManifestPath].forEach((manifestPath) => {
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (manifest.segments) {
            Object.assign(allSegments, manifest.segments);
          }
        } catch (e) {
          log(
            `Warning: Could not read segment manifest ${manifestPath}: ${e.message}`,
          );
        }
      }
    });

    if (Object.keys(allSegments).length > 0) {
      // MetadataV2 fields as proper typed values (not stringified).
      // V1 consumers iterate flat string→string entries and skip non-string
      // values, so nested objects don't interfere with v1 file-hash lookups.
      metadata.runtimeGraphVersion = 2;
      metadata.commonEntry = {
        file: 'common.jsbundle.hbc',
        sha256: metadata['common.jsbundle.hbc'] || '',
      };
      metadata.mainEntry = {
        file: 'main.jsbundle.hbc',
        sha256: metadata['main.jsbundle.hbc'] || '',
      };
      metadata.backgroundEntry = {
        file: 'background.bundle',
        sha256: metadata['background.bundle'] || '',
      };
      metadata.segments = allSegments;
      log(`MetadataV2: ${Object.keys(allSegments).length} segment(s) embedded`);
    }

    // Write metadata.json
    const metadataPath = path.join(dirPath, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    log(`Generated metadata.json at: ${metadataPath}`);
    log(`Total files processed: ${Object.keys(metadata).length}`);
  } else {
    console.warn(`Directory not found: ${dirPath}`);
  }
};

const ensureSplitBundleBuildEnv = () => {
  if (!enableNativeBackgroundThread) {
    return;
  }
  if (process.env.ONEKEY_PLATFORM !== 'app') {
    throw new Error(
      '[build-bundle] ONEKEY_PLATFORM must be "app" for native split bundle builds',
    );
  }
  if (!process.env.SPLIT_BUNDLE) {
    throw new Error(
      '[build-bundle] SPLIT_BUNDLE must be enabled when ENABLE_NATIVE_BACKGROUND_THREAD=true',
    );
  }
  if (process.env.SPLIT_BUNDLE_SEGMENTS !== 'true') {
    throw new Error(
      '[build-bundle] SPLIT_BUNDLE_SEGMENTS must be "true" when ENABLE_NATIVE_BACKGROUND_THREAD=true',
    );
  }
};

const assertSplitBundleOutputs = ({
  runtimeTarget,
  bundlePath,
  requireSegments = true,
}) => {
  if (!enableNativeBackgroundThread) {
    return;
  }

  const manifestPath = getManifestPath(runtimeTarget);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `[build-bundle] Missing segment manifest for ${runtimeTarget}: ${manifestPath}`,
    );
  }

  const bundleCode = fs.readFileSync(bundlePath, 'utf8');
  if (!bundleCode.includes('__SEGMENT_MANIFEST__')) {
    throw new Error(
      `[build-bundle] ${runtimeTarget} bundle did not inject __SEGMENT_MANIFEST__`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.segments || typeof manifest.segments !== 'object') {
    throw new Error(
      `[build-bundle] Invalid segment manifest for ${runtimeTarget}: ${manifestPath}`,
    );
  }

  if (requireSegments && Object.keys(manifest.segments).length === 0) {
    throw new Error(
      `[build-bundle] ${runtimeTarget} manifest is empty; split serializer did not produce any segments`,
    );
  }
};

const generateFileInfo = async (filePath, outputFilePath, appType) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const size = fileBuffer.length;

  const fileName = path.basename(filePath);
  const fileDir = path.dirname(filePath);
  const infoFileName = `${fileName}.info`;
  const infoFilePath = outputFilePath || path.join(fileDir, infoFileName);

  const fileInfo = {
    fileName,
    sha256,
    size,
    generatedAt: new Date().toISOString(),
  };

  if (appType) {
    fileInfo.appType = appType;
    fileInfo.appVersion = process.env.BUILD_APP_VERSION;
    fileInfo.buildNumber = process.env.BUILD_NUMBER;
    fileInfo.bundleVersion = process.env.BUILD_BUNDLE_VERSION;
  }

  fs.writeFileSync(infoFilePath, JSON.stringify(fileInfo, null, 2));
  log(`Generated info file: ${infoFilePath}`);
  log(`SHA256: ${sha256}`);
  log(`Size: ${size} bytes`);
};

const runReactNativeBundle = ({
  platform,
  entryFile,
  assetsDest,
  bundleOutput,
  sourceMapOutput,
  runtimeTarget,
}) => {
  execSync(
    `npx react-native bundle \
    --dev false \
    --minify false \
    --platform ${platform} \
    --entry-file ${entryFile} \
    --reset-cache \
    --assets-dest ${assetsDest} \
    --bundle-output ${bundleOutput} \
    --sourcemap-output ${sourceMapOutput}
    `,
    {
      stdio: 'inherit',
      cwd: mobileDirPath,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
        NODE_ENV: 'production',
        ONEKEY_PLATFORM: 'app',
        ...(runtimeTarget ? { METRO_RUNTIME_TARGET: runtimeTarget } : {}),
      },
    },
  );
};

const composeSourceMaps = ({
  packagerMapPath,
  hermesMapPath,
  outputPath,
  label,
}) => {
  const composeSourceMapsCommand = `${nodeExecutablePath} ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} ${packagerMapPath} ${hermesMapPath} -o ${outputPath}`;
  log(`${label} compose source maps command`, composeSourceMapsCommand);
  execSync(composeSourceMapsCommand, { stdio: 'inherit' });
  log(`${label} compose source maps done`);
};

const copyDebugIdToSourceMap = ({ packagerMapPath, sourceMapPath, label }) => {
  log(`${label} copy debugid`);
  execSync(
    `${nodeExecutablePath} ${path.join(
      projectRootPath,
      'node_modules/@sentry/react-native/scripts/copy-debugid.js',
    )} ${packagerMapPath} ${sourceMapPath}`,
    { stdio: 'inherit' },
  );
  log(`${label} copy debugid done`);
};

const uploadSourceMapsToSentry = ({ bundlePath, sourceMapPath, label }) => {
  if (!(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT)) {
    return;
  }
  log(`${label} upload source maps`);
  execSync(
    `${path.join(
      projectRootPath,
      'node_modules/@sentry/cli/bin/sentry-cli',
    )} sourcemaps upload --debug-id-reference --strip-prefix ${projectRootPath} ${bundlePath} ${sourceMapPath} --org=${SENTRY_ORG} --project=${SENTRY_PROJECT} --auth-token=${SENTRY_AUTH_TOKEN}`,
    {
      stdio: 'inherit',
      cwd: projectRootPath,
    },
  );
  log(`${label} upload source maps done`);
};

const buildBackgroundBundle = async ({
  platform,
  buildOutputAssetPath,
  assetsOutputPath,
}) => {
  const backgroundBundleJsPath = buildOutputAssetPath('background.bundle.js');
  const backgroundBundleHbcPath = buildOutputAssetPath('background.bundle.hbc');
  const backgroundBundlePath = buildOutputAssetPath('background.bundle');
  const backgroundBundlePackagerMapPath = buildOutputAssetPath(
    'background.bundle.packager.map',
  );
  const backgroundBundleMapPath = buildOutputAssetPath('background.bundle.map');

  log(`build ${platform} background bundle start`);
  runReactNativeBundle({
    platform,
    entryFile: backgroundIndexFilePath,
    assetsDest: assetsOutputPath,
    bundleOutput: backgroundBundleJsPath,
    sourceMapOutput: backgroundBundlePackagerMapPath,
    runtimeTarget: 'background',
  });
  log(`build ${platform} background bundle done`);

  log(`build ${platform} background bundle compress to hbc`);
  execSync(
    `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${backgroundBundleHbcPath} ${backgroundBundleJsPath}`,
    { stdio: 'inherit' },
  );
  log(`build ${platform} background bundle compress to hbc done`);

  composeSourceMaps({
    packagerMapPath: backgroundBundlePackagerMapPath,
    hermesMapPath: `${backgroundBundleHbcPath}.map`,
    outputPath: backgroundBundleMapPath,
    label: `build ${platform} background bundle`,
  });
  copyDebugIdToSourceMap({
    packagerMapPath: backgroundBundlePackagerMapPath,
    sourceMapPath: backgroundBundleMapPath,
    label: `build ${platform} background bundle`,
  });

  fs.moveSync(backgroundBundleHbcPath, backgroundBundlePath, {
    overwrite: true,
  });
  uploadSourceMapsToSentry({
    bundlePath: backgroundBundlePath,
    sourceMapPath: backgroundBundleMapPath,
    label: `build ${platform} background bundle`,
  });

  fs.rmSync(backgroundBundleJsPath, { force: true });
  fs.rmSync(backgroundBundlePackagerMapPath, { force: true });
  fs.rmSync(`${backgroundBundleHbcPath}.map`, { force: true });
};

/**
 * Run async tasks with a concurrency limit.
 */
const runWithConcurrency = async (tasks, concurrency) => {
  const results = [];
  let index = 0;
  const run = async () => {
    while (index < tasks.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, run),
  );
  return results;
};

/**
 * Build HBC segments from JS segment files produced by the segment serializer.
 * Compiles segments in parallel (up to 4 concurrent hermesc processes) for speed.
 * For each .seg.js file in the segments directory:
 *   1. Compile to HBC with hermesc
 *   2. Compose sourcemaps
 *   3. Copy debug ID for Sentry
 *   4. Upload to Sentry
 *   5. Clean up intermediate files
 */
const buildSegments = async ({
  platform,
  buildOutputAssetPath,
  inputDir,
  outputSubdir,
}) => {
  const segmentsInputDir = inputDir || SEGMENTS_INPUT_DIR;
  if (!fs.existsSync(segmentsInputDir)) {
    log(`No segments directory found at ${segmentsInputDir}, skipping`);
    return;
  }

  const segFiles = fs
    .readdirSync(segmentsInputDir)
    .filter((f) => f.endsWith('.seg.js'));
  if (segFiles.length === 0) {
    log('No segment files found, skipping');
    return;
  }

  const segmentsOutputDir = buildOutputAssetPath(outputSubdir || 'segments');
  if (!fs.existsSync(segmentsOutputDir)) {
    fs.mkdirSync(segmentsOutputDir, { recursive: true });
  }

  log(`build ${platform} segments: ${segFiles.length} segments found`);

  const CONCURRENCY = parseInt(
    process.env.SEGMENT_BUILD_CONCURRENCY || '4',
    10,
  );

  const tasks = segFiles.map((segFile) => async () => {
    const baseName = segFile.replace('.seg.js', '');
    const segJsPath = path.join(segmentsInputDir, segFile);
    const segHbcPath = path.join(segmentsOutputDir, `${baseName}.seg.hbc`);
    const segFinalPath = path.join(segmentsOutputDir, `${baseName}.seg.hbc`);
    const segMapPath = path.join(segmentsOutputDir, `${baseName}.seg.map`);

    log(`  segment: ${baseName}`);

    // Compile to HBC
    execSync(
      `${HERMES_COMMAND} -O -emit-binary -output-source-map -out=${segHbcPath} ${segJsPath}`,
      { stdio: 'inherit' },
    );

    // Compose sourcemaps (if packager map exists)
    const packagerMapPath = segJsPath.replace('.seg.js', '.seg.packager.map');
    if (fs.existsSync(packagerMapPath)) {
      composeSourceMaps({
        packagerMapPath,
        hermesMapPath: `${segHbcPath}.map`,
        outputPath: segMapPath,
        label: `segment ${baseName}`,
      });
      copyDebugIdToSourceMap({
        packagerMapPath,
        sourceMapPath: segMapPath,
        label: `segment ${baseName}`,
      });
    } else if (fs.existsSync(`${segHbcPath}.map`)) {
      // No packager map — use HBC map directly
      fs.moveSync(`${segHbcPath}.map`, segMapPath, { overwrite: true });
    }

    // Upload to Sentry
    uploadSourceMapsToSentry({
      bundlePath: segFinalPath,
      sourceMapPath: segMapPath,
      label: `segment ${baseName}`,
    });

    // Clean up intermediate HBC map
    if (fs.existsSync(`${segHbcPath}.map`)) {
      fs.rmSync(`${segHbcPath}.map`, { force: true });
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  log(`build ${platform} segments done`);
};

const runUnionBuild = ({
  platform,
  mainBundleOutput,
  mainSourceMapOutput,
  commonBundleOutput,
  commonSourceMapOutput,
  backgroundBundleOutput,
  backgroundSourceMapOutput,
  assetsDest,
}) => {
  log(`union build: platform=${platform}`);
  execSync(
    `${nodeExecutablePath} ${path.join(
      mobileDirPath,
      'scripts/unionBuild.js',
    )} --platform ${platform} --main-bundle-output ${mainBundleOutput} --main-sourcemap-output ${mainSourceMapOutput} --common-bundle-output ${commonBundleOutput} --common-sourcemap-output ${commonSourceMapOutput} --background-bundle-output ${backgroundBundleOutput} --background-sourcemap-output ${backgroundSourceMapOutput} --assets-dest ${assetsDest}`,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
        NODE_ENV: 'production',
        ONEKEY_PLATFORM: 'app',
      },
    },
  );
  log('union build done');
};

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

  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: mv',
  );
  fs.moveSync(
    buildIOSOutputAssetPath('main.jsbundle.map'),
    buildIOSOutputAssetPath('main.jsbundle.packager.map'),
  );
  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: done',
  );

  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: main.jsbundle.map',
  );
  const composeSourceMapsCommand = `${nodeExecutablePath} ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} ${buildIOSOutputAssetPath(
    'main.jsbundle.packager.map',
  )} ${buildIOSOutputAssetPath(
    'main.jsbundle.hbc.map',
  )} -o ${buildIOSOutputAssetPath('main.jsbundle.map')}`;
  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: main.jsbundle.map: command',
    composeSourceMapsCommand,
  );
  execSync(composeSourceMapsCommand, { stdio: 'inherit' });
  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: main.jsbundle.map: done',
  );

  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: main.jsbundle.map: copy debugid',
  );
  execSync(
    `${nodeExecutablePath} ${path.join(
      projectRootPath,
      'node_modules/@sentry/react-native/scripts/copy-debugid.js',
    )} ${buildIOSOutputAssetPath(
      'main.jsbundle.packager.map',
    )} ${buildIOSOutputAssetPath('main.jsbundle.map')}`,
    { stdio: 'inherit' },
  );
  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: main.jsbundle.map: copy debugid done',
  );
  fs.rmSync(buildIOSOutputAssetPath('main.jsbundle.packager.map'));
  log(
    'Compose Hermes bytecode and (React Native Packager) Metro source maps: main.jsbundle.map: copy debugid done',
  );

  if (SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT) {
    log('build ios bundle upload source maps');
    execSync(
      `${nodeExecutablePath} node_modules/@sentry/cli/bin/sentry-cli sourcemaps upload --debug-id-reference --strip-prefix ${projectRootPath} ${buildIOSOutputAssetPath(
        'main.jsbundle',
      )} ${buildIOSOutputAssetPath(
        'main.jsbundle.map',
      )} --org=${SENTRY_ORG} --project=${SENTRY_PROJECT} --auth-token=${SENTRY_AUTH_TOKEN}`,
      {
        stdio: 'inherit',
        cwd: projectRootPath,
      },
    );
    log('build ios bundle upload source maps done');
  }

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

    uploadSourceMapsToSentry({
      bundlePath: commonBundleHbcPath,
      sourceMapPath: commonBundleMapPath,
      label: 'build ios common bundle',
    });

    fs.rmSync(commonBundleJsPath, { force: true });
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
    uploadSourceMapsToSentry({
      bundlePath: backgroundBundlePath,
      sourceMapPath: backgroundBundleMapPath,
      label: 'build ios background bundle',
    });

    fs.rmSync(backgroundBundleJsPath, { force: true });
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
  // Move common bundle into dist if it exists (union build)
  const iosCommonBundleHbc = buildIOSOutputAssetPath('common.jsbundle.hbc');
  if (fs.existsSync(iosCommonBundleHbc)) {
    fs.moveSync(iosCommonBundleHbc, buildIOSOutputAssetPath('dist/common.jsbundle.hbc'));
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

  fs.moveSync(
    buildAndroidOutputAssetPath('main.jsbundle.map'),
    buildAndroidOutputAssetPath('main.jsbundle.packager.map'),
  );

  const composeSourceMapsCommand = `${nodeExecutablePath} ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} ${buildAndroidOutputAssetPath(
    'main.jsbundle.packager.map',
  )} ${buildAndroidOutputAssetPath(
    'main.jsbundle.hbc.map',
  )} -o ${buildAndroidOutputAssetPath('main.jsbundle.map')}`;
  log(
    'build android bundle compose source maps command',
    composeSourceMapsCommand,
  );
  execSync(composeSourceMapsCommand, { stdio: 'inherit' });
  log('build android bundle compose source maps done');

  log('build android bundle compose source maps: copy debugid');
  execSync(
    `${nodeExecutablePath} ${path.join(
      projectRootPath,
      'node_modules/@sentry/react-native/scripts/copy-debugid.js',
    )} ${buildAndroidOutputAssetPath(
      'main.jsbundle.packager.map',
    )} ${buildAndroidOutputAssetPath('main.jsbundle.map')}`,
    { stdio: 'inherit' },
  );
  log('build android bundle compose source maps: copy debugid done');

  log('build android bundle compose source maps: remove packager map');
  fs.rmSync(buildAndroidOutputAssetPath('main.jsbundle.packager.map'));
  log('build android bundle compose source maps: remove packager map done');

  if (SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT) {
    log('build android bundle upload source maps');
    const uploadSourceMapsCommand = `${path.join(
      projectRootPath,
      'node_modules/@sentry/cli/bin/sentry-cli',
    )} sourcemaps upload --debug-id-reference --strip-prefix ${projectRootPath} ${buildAndroidOutputAssetPath(
      'main.jsbundle.hbc',
    )} ${buildAndroidOutputAssetPath(
      'main.jsbundle.map',
    )} --org=${SENTRY_ORG} --project=${SENTRY_PROJECT} --auth-token=${SENTRY_AUTH_TOKEN}`;
    console.log(uploadSourceMapsCommand);
    execSync(uploadSourceMapsCommand, {
      stdio: 'inherit',
      cwd: projectRootPath,
    });
    log('build android bundle upload source maps done');
  }

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
  // Move common bundle into dist if it exists (union build)
  const androidCommonBundleHbc = buildAndroidOutputAssetPath(
    'common.jsbundle.hbc',
  );
  if (fs.existsSync(androidCommonBundleHbc)) {
    fs.moveSync(
      androidCommonBundleHbc,
      buildAndroidOutputAssetPath('dist/common.jsbundle.hbc'),
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

const buildWebEmbed = async () => {
  log('build web embed');
  execSync(`npx webpack build`, {
    stdio: 'inherit',
    cwd: path.join(projectRootPath, 'apps/web-embed'),
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=8192',
      NODE_ENV: 'production',
    },
  });
  log('build web embed done');
};

async function main() {
  await cleanBundleOutput();
  await buildWebEmbed();
  await buildIOSBundle();
  await buildAndroidBundle();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
