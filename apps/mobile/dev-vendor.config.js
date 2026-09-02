const path = require('path');

const SCHEMA_VERSION = 3;
const STRATEGY_VERSION = 4;
const RELEASE_SCHEMA_VERSION = 2;
const RELEASE_ASSET_PREFIX = 'metro-dev-prebundle';
const RELEASE_ATTESTATION_BUNDLE_NAME = `${RELEASE_ASSET_PREFIX}-attestations.jsonl`;
const OCI_ARTIFACT_TYPE = 'application/vnd.onekey.metro-dev-prebundle.v2';
const OCI_REGISTRY = 'ghcr.io';
const OCI_REPOSITORY = 'onekeyhq/metro-dev-prebundle';
const SOURCE_REPOSITORY = 'OneKeyHQ/app-monorepo';

const transformationEnvironment = {
  BABEL_ENV: 'development',
  E2E_MODE: undefined,
  ENABLE_NATIVE_BACKGROUND_THREAD: 'true',
  EXT_CHANNEL: undefined,
  EXT_MANIFEST_V3: undefined,
  JEST_WORKER_ID: undefined,
  METRO_RUNTIME_TARGET: undefined,
  NODE_ENV: 'development',
  ONEKEY_STARTUP_PROFILE: undefined,
  ONEKEY_PLATFORM: 'app',
  PERF_MONITOR_ENABLED: undefined,
  RN_HARNESS: undefined,
  SPLIT_BUNDLE_SEGMENTS: undefined,
  STORYBOOK_ENABLED: undefined,
  TAMAGUI_TARGET: 'native',
  UNION_BUILD: undefined,
  WITH_ROZENITE: 'true',
};

const fingerprintFiles = [
  '.env.expo',
  '.env.version',
  'apps/mobile/babel-plugin-jest-compat.js',
  'apps/mobile/babel.config.js',
  'apps/mobile/dev-vendor.config.js',
  'apps/mobile/metro.config.js',
  'apps/mobile/package.json',
  'apps/mobile/plugins/devVendor.js',
  'apps/mobile/plugins/index.js',
  'apps/mobile/plugins/map.js',
  'apps/mobile/plugins/moduleIdRegistry.js',
  'apps/mobile/plugins/startupProfilePrologue.js',
  'apps/mobile/scripts/build-dev-vendor.js',
  'apps/mobile/svgx-transformer.js',
  'development/babelTools.js',
  'development/developmentConsts.js',
  'development/env.js',
  'development/envExposedToClient.js',
  'development/platformEnvDefine.js',
  'package.json',
  'packages/components/src/utils/scale.ts',
  'packages/components/src/utils/webFontFamily.ts',
  'packages/components/tamagui.animations.ts',
  'packages/components/tamagui.config.ts',
  'packages/shared/src/buildTimeEnv.js',
  'yarn.lock',
];

function applyTransformationEnvironment(env) {
  for (const [key, value] of Object.entries(transformationEnvironment)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
}

function getTransformationEnvironment(env) {
  return Object.fromEntries(
    Object.keys(transformationEnvironment).map((key) => [
      key,
      env[key] ?? null,
    ]),
  );
}

module.exports = {
  OCI_ARTIFACT_TYPE,
  OCI_REGISTRY,
  OCI_REPOSITORY,
  RELEASE_ASSET_PREFIX,
  RELEASE_ATTESTATION_BUNDLE_NAME,
  RELEASE_SCHEMA_VERSION,
  SCHEMA_VERSION,
  SOURCE_REPOSITORY,
  STRATEGY_VERSION,
  applyTransformationEnvironment,
  commonBytecodeName: 'common.hbc',
  commonSourceName: 'common.js',
  fingerprintDirectories: ['packages/components/colors', 'patches'],
  fingerprintFiles,
  fingerprintOptionalFiles: [],
  getTransformationEnvironment,
  isVendorModule(moduleKey) {
    return moduleKey.startsWith('node_modules/');
  },
  outputRoot(projectRoot) {
    return path.resolve(projectRoot, 'out-dir-bundle/dev-vendor');
  },
  releaseFingerprintFiles: [
    '.github/workflows/metro-dev-prebundle.yml',
    'apps/mobile/bundle-registry/metro-dev-prebundle-trusted-root.jsonl',
    'apps/mobile/scripts/metro-dev-prebundle.js',
  ],
  releaseTagPrefix: `${RELEASE_ASSET_PREFIX}-v${RELEASE_SCHEMA_VERSION}`,
};
