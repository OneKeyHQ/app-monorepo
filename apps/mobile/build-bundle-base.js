/* eslint-disable onekey/no-raw-error */
/* cspell:ignore debugid */
require('../../development/env');

const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const fs = require('fs-extra');

const {
  SEGMENTS_INPUT_DIR,
  getSegmentsDir,
  getManifestPath,
  getMergedModuleIdMapPath,
  getModuleIdMapPath,
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

// Compose a Sentry release identifier from CI env vars. sentry-cli `sourcemaps
// upload --debug-id-reference` requires either an injected debug-id OR an
// explicit `--release`; when @sentry/react-native's metro plugin fails to
// inject debug-ids (e.g. packager source map missing the field), the upload
// would otherwise fail the whole bundle job. Pass --release as a fallback so
// the upload always has *something* to associate the sourcemap with.
const resolveSentryRelease = () => {
  const appVersion = process.env.BUILD_APP_VERSION;
  const buildNumber = process.env.BUILD_NUMBER;
  const bundleVersion = process.env.BUILD_BUNDLE_VERSION;
  const parts = [];
  if (appVersion) parts.push(appVersion);
  if (buildNumber) parts.push(buildNumber);
  if (bundleVersion) parts.push(bundleVersion);
  if (parts.length === 0) {
    return '';
  }
  return parts.join('+');
};

const SENTRY_RELEASE = resolveSentryRelease();

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

const cleanBundleOutput = async ({ platform } = {}) => {
  fs.rmSync(webEmbedOutputPath, { recursive: true, force: true });
  if (!platform) {
    fs.rmSync(bundleOutputPath, { recursive: true, force: true });
    fs.rmSync(zipOutputPath, { recursive: true, force: true });
  } else {
    // Per-platform clean: only remove this platform's bundle dir + its zip
    // artifact so parallel iOS/Android jobs don't stomp on a shared volume.
    fs.rmSync(path.join(bundleOutputPath, platform), {
      recursive: true,
      force: true,
    });
    const zipName =
      platform === 'ios' ? 'ios-bundle.zip' : 'android-bundle.zip';
    fs.rmSync(buildZipOutputAssetPath(zipName), { force: true });
    fs.rmSync(buildZipOutputAssetPath(`${platform}.metadata.json.info`), {
      force: true,
    });
    fs.rmSync(buildZipOutputAssetPath(`${zipName}.info`), { force: true });
  }
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
  fs.rmSync(getModuleIdMapPath('main'), { force: true });
  fs.rmSync(getModuleIdMapPath('background'), { force: true });
  fs.rmSync(getMergedModuleIdMapPath(), { force: true });
};

/**
 * Copy the merged moduleId → relativePath map produced by unionBuild.js (or
 * synthesize one from per-runtime maps when running the legacy two-step
 * path) into the per-platform dist directory so the platform packager can
 * pick it up alongside the bundles. The file is intentionally kept small
 * (~1MB) so it is safe to ship inside the APK / .app for crash post-mortem.
 */
const copyModuleIdMapToPlatformDist = (platformDistDir) => {
  const mergedPath = getMergedModuleIdMapPath();
  let mapJson;
  if (fs.existsSync(mergedPath)) {
    mapJson = fs.readFileSync(mergedPath, 'utf8');
  } else {
    // Legacy two-step builds — merge per-runtime maps if they exist.
    const runtimeMaps = {};
    for (const runtime of ['main', 'background']) {
      const p = getModuleIdMapPath(runtime);
      if (fs.existsSync(p)) {
        runtimeMaps[runtime] = JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
    if (Object.keys(runtimeMaps).length === 0) {
      log('module-id map not found, skipping copy');
      return;
    }
    const merged = { common: {}, main: {}, background: {}, segments: {} };
    for (const [runtime, data] of Object.entries(runtimeMaps)) {
      Object.assign(merged[runtime], data.eager || {});
      for (const [segKey, segEntry] of Object.entries(data.segments || {})) {
        merged.segments[segKey] = segEntry;
      }
    }
    mapJson = JSON.stringify(merged);
  }
  fs.ensureDirSync(platformDistDir);
  const destPath = path.join(platformDistDir, 'module-id-map.json');
  fs.writeFileSync(destPath, mapJson);
  log(`module-id map → ${destPath}`);
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

    // Flat file→sha256 map only (scalar string values).
    // native consumers (iOS Swift / Android Kotlin) iterate this flat map
    // for file-level SHA256 verification. Structured bundle/segment manifests
    // used to live here as nested objects but were dropped: Android
    // JSONObject.getString() throws on non-string values, and no runtime code
    // actually reads those descriptors — native resolves bundle entries by
    // hard-coded filenames (common.bundle / main.jsbundle.hbc /
    // background.bundle) and loads segments via SplitBundleLoader at JS call
    // time.
    const mainManifestPath = getManifestPath('main');
    const bgManifestPath = getManifestPath('background');
    let hasSegments = false;
    [mainManifestPath, bgManifestPath].forEach((manifestPath) => {
      if (
        !hasSegments &&
        fs.existsSync(manifestPath) &&
        Object.keys(
          JSON.parse(fs.readFileSync(manifestPath, 'utf-8')).segments || {},
        ).length > 0
      ) {
        hasSegments = true;
      }
    });
    const isThreeBundleBuild = useUnionBuild || hasSegments;

    if (isThreeBundleBuild) {
      metadata.bundleFormat = 'three-bundle';
      metadata.requiresCommonBundle = 'true';
      log('metadata: bundleFormat=three-bundle, requiresCommonBundle=true');
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
  // In union build mode, __SEGMENT_MANIFEST__ is injected into the common
  // bundle (shared by both runtimes), not into main or background bundles.
  if (!useUnionBuild && !bundleCode.includes('__SEGMENT_MANIFEST__')) {
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

// Single source of truth for sentry-cli sourcemaps upload. Always passes
// `--release` so the upload satisfies sentry-cli's "either debug-id OR
// release" requirement even when @sentry/react-native's metro debugId
// injection silently produces no `debugId` in the packager source map.
const uploadSourceMapsToSentry = ({ bundlePath, sourceMapPath, label }) => {
  if (!(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT)) {
    return;
  }
  log(`${label} upload source maps`);
  const cli = path.join(
    projectRootPath,
    'node_modules/@sentry/cli/bin/sentry-cli',
  );
  const releaseFlag = SENTRY_RELEASE ? `--release "${SENTRY_RELEASE}"` : '';
  execSync(
    `${cli} sourcemaps upload --debug-id-reference ${releaseFlag} --strip-prefix ${projectRootPath} ${bundlePath} ${sourceMapPath} --org=${SENTRY_ORG} --project=${SENTRY_PROJECT} --auth-token=${SENTRY_AUTH_TOKEN}`,
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
 * Run hermesc asynchronously via spawn so that runWithConcurrency can
 * actually overlap compilations. execSync would block the event loop,
 * serializing every task regardless of the concurrency limit.
 */
const runHermescAsync = ({ outPath, inputPath }) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      HERMES_COMMAND,
      [
        '-O',
        '-emit-binary',
        '-output-source-map',
        `-out=${outPath}`,
        inputPath,
      ],
      { stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `hermesc failed for ${inputPath} (code=${code}, signal=${signal})`,
          ),
        );
      }
    });
  });

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
    // unionBuild.js now compiles each segment's .seg.hbc right after
    // emission (so manifest sha256 can hash the real compiled bytes before
    // it gets baked into common.bundle). Re-running hermesc here on the
    // same .seg.js would waste ~1-2× total build time for a byte-identical
    // output — copy the pre-built .seg.hbc (and its paired sourcemap)
    // into segmentsOutputDir instead, then fall through to the normal
    // sourcemap compose + Sentry upload pipeline.
    const preBuiltHbcPath = path.join(segmentsInputDir, `${baseName}.seg.hbc`);
    const preBuiltHbcMapPath = `${preBuiltHbcPath}.map`;

    log(`  segment: ${baseName}`);

    if (fs.existsSync(preBuiltHbcPath)) {
      fs.copyFileSync(preBuiltHbcPath, segHbcPath);
      if (fs.existsSync(preBuiltHbcMapPath)) {
        fs.copyFileSync(preBuiltHbcMapPath, `${segHbcPath}.map`);
      }
    } else {
      // Compile to HBC via spawn so concurrent segment compiles actually run
      // in parallel. execSync here would block the event loop and serialize
      // all segments regardless of the CONCURRENCY setting.
      await runHermescAsync({
        outPath: segHbcPath,
        inputPath: segJsPath,
      });
    }

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
    // Sourcemap has been uploaded to Sentry above — don't ship it in the APK
    // assets (saves ~15MB compressed; each segment emits an adjacent .seg.map
    // that would otherwise be picked up by Gradle's copy { from segmentsDir }).
    if (fs.existsSync(segMapPath)) {
      fs.rmSync(segMapPath, { force: true });
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

  // Integrity check: every cross-segment sync dependency in each emitted
  // segment JS must be covered by the segment's transitive `dependsOn`.
  // Uncovered edges are latent "Requiring unknown module" crashes; fail the
  // build now so they never ship. Set ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK=1 to
  // bypass during local debugging (never in CI).
  if (process.env.ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK !== '1') {
    log('union build: split-bundle integrity check');
    execSync(
      `${nodeExecutablePath} ${path.join(
        mobileDirPath,
        'scripts/check-split-bundle-integrity.js',
      )}`,
      { stdio: 'inherit' },
    );
    log('union build: split-bundle integrity check passed');
  } else {
    log(
      'union build: integrity check SKIPPED by ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK',
    );
  }
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

module.exports = {
  // constants / paths
  mobileDirPath,
  projectRootPath,
  indexFilePath,
  backgroundIndexFilePath,
  bundleOutputPath,
  zipOutputPath,
  webEmbedOutputPath,
  backgroundProtocolVersion,
  useUnionBuild,
  enableNativeBackgroundThread,
  HERMES_COMMAND,
  nodeExecutablePath,
  SENTRY_ORG,
  SENTRY_PROJECT,
  SENTRY_AUTH_TOKEN,
  SENTRY_RELEASE,
  // path helpers
  buildZipOutputAssetPath,
  buildIOSOutputAssetPath,
  buildAndroidOutputAssetPath,
  // io / fs helpers
  log,
  cleanBundleOutput,
  ensureBundleOutputPath,
  ensureZipOutputPath,
  copyModuleIdMapToPlatformDist,
  generateMetadataJson,
  generateFileInfo,
  // build env helpers
  ensureSplitBundleBuildEnv,
  assertSplitBundleOutputs,
  // bundle pipeline helpers
  runReactNativeBundle,
  composeSourceMaps,
  copyDebugIdToSourceMap,
  uploadSourceMapsToSentry,
  buildBackgroundBundle,
  runHermescAsync,
  runWithConcurrency,
  buildSegments,
  runUnionBuild,
  // entry helpers
  buildWebEmbed,
  // segment paths re-exports for callers that need them without re-requiring
  getSegmentsDir,
};
