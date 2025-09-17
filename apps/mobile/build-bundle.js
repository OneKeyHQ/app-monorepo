require('../../development/env');

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const mobileDirPath = __dirname;
const projectRootPath = path.join(mobileDirPath, '../..');
const indexFilePath = path.join(mobileDirPath, 'index.ts');
const bundleOutputPath = path.join(mobileDirPath, 'out-dir-bundle');

const SENTRY_ORG = 'onekey-bb';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_TOKEN;

const buildIOSOutputAssetPath = (assetName) => {
  return path.join(bundleOutputPath, 'ios', assetName);
};

const buildAndroidOutputAssetPath = (assetName) => {
  return path.join(bundleOutputPath, 'android', assetName);
};

const buildAndroidOutputBundlePath = (bundleName) => {
  return path.join(bundleOutputPath, 'android', bundleName);
};

const cleanBundleOutput = async () => {
  fs.rmSync(bundleOutputPath, { recursive: true, force: true });
};

const ensureBundleOutputPath = async () => {
  if (!fs.existsSync(bundleOutputPath)) {
    fs.mkdirSync(bundleOutputPath, { recursive: true });
  }
};

const buildIOSBundle = async () => {
  ensureBundleOutputPath();
  console.log('build ios bundle');
  execSync(
    `npx react-native bundle \
    --dev false \
    --minify false \
    --platform ios \
    --entry-file ${indexFilePath} \
    --reset-cache \
    --assets-dest ${buildIOSOutputAssetPath('assets')} \
    --bundle-output ${buildIOSOutputAssetPath('main.jsbundle')} \
    --sourcemap-output ${buildIOSOutputAssetPath('main.jsbundle.map')}   

    `,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=8192',
        NODE_ENV: 'production',
      },
    },
  );
  console.log('build ios bundle done');

  console.log('build ios bundle hbc');
  execSync(
    `${path.join(
      mobileDirPath,
      'ios/Pods/hermes-engine/destroot/bin/hermesc',
    )} -O -emit-binary -output-source-map -out=${buildIOSOutputAssetPath(
      'main.jsbundle.hbc',
    )} ${buildIOSOutputAssetPath('main.jsbundle')}`,
    { stdio: 'inherit' },
  );
  console.log('build ios bundle hbc done');

  console.log('build ios bundle packager map');
  fs.moveSync(
    buildIOSOutputAssetPath('main.jsbundle.map'),
    buildIOSOutputAssetPath('main.jsbundle.packager.map'),
  );
  console.log('build ios bundle packager map done');

  console.log('build ios bundle compose source maps');
  execSync(
    `node \
  ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} \
  ${buildIOSOutputAssetPath('main.jsbundle.packager.map')} \
  ${buildIOSOutputAssetPath('main.jsbundle.hbc.map')} \
  -o ${buildIOSOutputAssetPath('main.jsbundle.map')}`,
    { stdio: 'inherit' },
  );
  console.log('build ios bundle compose source maps done');

  console.log('build ios bundle compose source maps');
  execSync(
    `node \
  ${path.join(
    projectRootPath,
    'node_modules/react-native/scripts/compose-source-maps.js',
  )} \
  ${buildIOSOutputAssetPath(
    'main.jsbundle.packager.map',
  )} ${buildIOSOutputAssetPath('main.jsbundle.map')}`,
    { stdio: 'inherit' },
  );
  console.log('build ios bundle compose source maps done');

  console.log('build ios bundle remove packager map');
  fs.rmSync(buildIOSOutputAssetPath('main.jsbundle.packager.map'));
  console.log('build ios bundle remove packager map done');

  if (SENTRY_AUTH_TOKEN) {
    console.log('build ios bundle upload source maps');
    execSync(
      `${path.join(
        projectRootPath,
        'node_modules/@sentry/cli/bin/sentry-cli',
      )}  sourcemaps upload \
  --debug-id-reference \
  --strip-prefix ${projectRootPath} \
  ${buildIOSOutputAssetPath('main.jsbundle')} ${buildIOSOutputAssetPath(
        'main.jsbundle.map',
      )}`,
      {
        stdio: 'inherit',
        env: {
          SENTRY_AUTH_TOKEN,
          SENTRY_ORG,
          SENTRY_PROJECT,
        },
      },
    );
    console.log('build ios bundle upload source maps done');
  }
  console.log('build ios bundle done');
};

const buildAndroidBundle = async () => {
  ensureBundleOutputPath();
  execSync(
    `npx react-native bundle \
    --dev false \
    --minify false \
    --platform android \
    --entry-file ${indexFilePath} \
    --reset-cache \
    --bundle-output ${buildAndroidOutputAssetPath('main.jsbundle')} \
    --sourcemap-output ${buildAndroidOutputAssetPath('main.jsbundle.map')}    
    `,
  );
};

cleanBundleOutput();
buildIOSBundle();
