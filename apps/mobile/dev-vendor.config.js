const path = require('path');

const SCHEMA_VERSION = 4;
const STRATEGY_VERSION = 5;
const NATIVE_CONTRACT_VERSION = 3;
const NATIVE_LOADER_PROTOCOL_VERSION = 2;
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
  'apps/mobile/scripts/native-dev-shell.js',
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

const nativeContractDependencies = {
  android: ['expo-image-loader', 'expo-navigation-bar'],
  ios: [
    'burnt',
    'expo-apple-authentication',
    'expo-glass-effect',
    'expo-modules-jsi',
  ],
  shared: [
    '@expo/dom-webview',
    '@expo/log-box',
    '@expo/ui',
    '@notifee/react-native',
    '@onekeyfe/react-native-app-update',
    '@onekeyfe/react-native-auto-size-input',
    '@onekeyfe/react-native-background-thread',
    '@onekeyfe/react-native-ble-utils',
    '@onekeyfe/react-native-bundle-crypto',
    '@onekeyfe/react-native-bundle-update',
    '@onekeyfe/react-native-chart-webview',
    '@onekeyfe/react-native-check-biometric-auth-changed',
    '@onekeyfe/react-native-cloud-kit-module',
    '@onekeyfe/react-native-device-utils',
    '@onekeyfe/react-native-image',
    '@onekeyfe/react-native-keychain-module',
    '@onekeyfe/react-native-lite-card',
    '@onekeyfe/react-native-native-logger',
    '@onekeyfe/react-native-network-throttle',
    '@onekeyfe/react-native-perf-memory',
    '@onekeyfe/react-native-perf-stats',
    '@onekeyfe/react-native-perp-depth-bar',
    '@onekeyfe/react-native-range-downloader',
    '@onekeyfe/react-native-scroll-guard',
    '@onekeyfe/react-native-segment-slider',
    '@onekeyfe/react-native-skeleton',
    '@onekeyfe/react-native-sni-connect',
    '@onekeyfe/react-native-splash-screen',
    '@onekeyfe/react-native-split-bundle-loader',
    '@onekeyfe/react-native-tab-view',
    '@onekeyfe/react-native-text-input',
    '@phantom/react-native-juicebox-sdk',
    '@react-native-async-storage/async-storage',
    '@react-native-community/datetimepicker',
    '@react-native-community/netinfo',
    '@react-native-community/slider',
    '@react-native-documents/picker',
    '@react-native-google-signin/google-signin',
    '@react-native-masked-view/masked-view',
    '@sentry/react-native',
    '@shopify/react-native-skia',
    '@walletconnect/react-native-compat',
    'expo',
    'expo-application',
    'expo-asset',
    'expo-blur',
    'expo-camera',
    'expo-clipboard',
    'expo-constants',
    'expo-crypto',
    'expo-device',
    'expo-file-system',
    'expo-font',
    'expo-haptics',
    'expo-image-manipulator',
    'expo-image-picker',
    'expo-keep-awake',
    'expo-linear-gradient',
    'expo-linking',
    'expo-local-authentication',
    'expo-localization',
    'expo-media-library',
    'expo-modules-core',
    'expo-notifications',
    'expo-screen-capture',
    'expo-screen-orientation',
    'expo-secure-store',
    'expo-sharing',
    'expo-splash-screen',
    'expo-web-browser',
    'hermes-compiler',
    'jcore-react-native',
    'jpush-react-native',
    'lottie-react-native',
    'react-native',
    'react-native-aes-crypto',
    'react-native-ble-plx',
    'react-native-camera-kit',
    'react-native-capture-protection',
    'react-native-cloud-fs',
    'react-native-dns-lookup',
    'react-native-fast-pbkdf2',
    'react-native-fs',
    'react-native-gesture-handler',
    'react-native-get-random-values',
    'react-native-image-colors',
    'react-native-image-crop-picker',
    'react-native-keyboard-controller',
    'react-native-mmkv',
    'react-native-network-info',
    'react-native-nitro-modules',
    'react-native-pager-view',
    'react-native-passkeys',
    'react-native-permissions',
    'react-native-ping',
    'react-native-purchases',
    'react-native-quick-base64',
    'react-native-quick-crypto',
    'react-native-reanimated',
    'react-native-safe-area-context',
    'react-native-screens',
    'react-native-svg',
    'react-native-tcp-socket',
    'react-native-video',
    'react-native-view-shot',
    'react-native-webview',
    'react-native-webview-cleaner',
    'react-native-worklets',
    'react-native-zip-archive',
    'realm',
  ],
};

const nativeContractFiles = {
  android: ['apps/mobile/android/gradle.properties'],
  ios: [
    'apps/mobile/ios/AppDelegate.swift',
    'apps/mobile/ios/Podfile.lock',
    'apps/mobile/ios/Podfile.properties.json',
  ],
  shared: ['apps/mobile/package.json', 'yarn.lock'],
};

const nativeContractDirectories = {
  android: [
    'apps/mobile/android/app-update-noop/src/main',
    'apps/mobile/android/app/src/debug',
    'apps/mobile/android/app/src/main',
    'apps/mobile/android/app/src/prod',
  ],
  ios: ['apps/mobile/ios/OneKeyWallet', 'apps/mobile/ios/ServiceExtension'],
  shared: [],
};

const shellInputDirectories = {
  android: [
    'apps/mobile/android/app/src',
    'apps/mobile/android/app-update-noop/src',
    'apps/mobile/android/build-logic',
  ],
  ios: [
    'apps/mobile/ios/OneKeyLogo.icon',
    'apps/mobile/ios/OneKeyWallet',
    'apps/mobile/ios/ServiceExtension',
    'apps/mobile/ios/bn.lproj',
    'apps/mobile/ios/de.lproj',
    'apps/mobile/ios/en.lproj',
    'apps/mobile/ios/es.lproj',
    'apps/mobile/ios/fr-FR.lproj',
    'apps/mobile/ios/fr.lproj',
    'apps/mobile/ios/hi.lproj',
    'apps/mobile/ios/id.lproj',
    'apps/mobile/ios/it-IT.lproj',
    'apps/mobile/ios/it.lproj',
    'apps/mobile/ios/ja-JP.lproj',
    'apps/mobile/ios/ja.lproj',
    'apps/mobile/ios/ko.lproj',
    'apps/mobile/ios/pt-BR.lproj',
    'apps/mobile/ios/pt-PT.lproj',
    'apps/mobile/ios/pt.lproj',
    'apps/mobile/ios/ru.lproj',
    'apps/mobile/ios/th.lproj',
    'apps/mobile/ios/uk-UA.lproj',
    'apps/mobile/ios/vi.lproj',
    'apps/mobile/ios/zh-HK.lproj',
    'apps/mobile/ios/zh-Hans.lproj',
    'apps/mobile/ios/zh-Hant.lproj',
  ],
  shared: [],
};

const shellInputFiles = {
  android: [
    '.github/workflows/mobile-dev-shell-android.yml',
    'apps/mobile/android/app-update-noop/build.gradle',
    'apps/mobile/android/app/build.gradle',
    'apps/mobile/android/app/debug.keystore',
    'apps/mobile/android/app/google-services.json',
    'apps/mobile/android/app/proguard-rules.pro',
    'apps/mobile/android/build.gradle',
    'apps/mobile/android/gradle.properties',
    'apps/mobile/android/gradle/wrapper/gradle-wrapper.jar',
    'apps/mobile/android/gradle/wrapper/gradle-wrapper.properties',
    'apps/mobile/android/gradlew',
    'apps/mobile/android/sentry.properties',
    'apps/mobile/android/settings.gradle',
  ],
  ios: [
    '.github/workflows/mobile-dev-shell-ios-simulator.yml',
    'apps/mobile/ios/.xcode.env',
    'apps/mobile/ios/AppDelegate.swift',
    'apps/mobile/ios/OneKeyWallet.xcodeproj/project.pbxproj',
    'apps/mobile/ios/OneKeyWallet.xcodeproj/xcshareddata/xcschemes/OneKeyWallet.xcscheme',
    'apps/mobile/ios/OneKeyWallet.xcworkspace/contents.xcworkspacedata',
    'apps/mobile/ios/OneKeyWallet.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist',
    'apps/mobile/ios/Podfile',
    'apps/mobile/ios/Podfile.lock',
    'apps/mobile/ios/Podfile.properties.json',
    'apps/mobile/ios/PrivacyInfo.xcprivacy',
    'apps/mobile/ios/sentry.properties',
  ],
  shared: [
    'apps/mobile/package.json',
    'apps/mobile/react-native.config.js',
    'apps/mobile/scripts/build-mobile-dev-shell.js',
    'yarn.lock',
  ],
};

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
  NATIVE_CONTRACT_VERSION,
  NATIVE_LOADER_PROTOCOL_VERSION,
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
  nativeContractDependencies,
  nativeContractDirectories,
  nativeContractFiles,
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
  shellInputDirectories,
  shellInputFiles,
  shellInputIgnoredDirectories: [
    'apps/mobile/android/app/src/main/assets/web-embed',
    'apps/mobile/ios/OneKeyWallet/web-embed',
  ],
};
