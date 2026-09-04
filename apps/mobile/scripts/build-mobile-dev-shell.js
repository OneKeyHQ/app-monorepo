#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const devVendorConfig = require('../dev-vendor.config');

const {
  getPlatformArtifact,
  getShellCompatibility,
} = require('./native-dev-shell');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOBILE_ROOT, '../..');
const WEB_EMBED_BUILD = path.join(REPO_ROOT, 'apps/web-embed/web-build');
const IOS_PRODUCTION_INFO_PLIST = path.join(
  MOBILE_ROOT,
  'ios/OneKeyWallet/Info.plist',
);
const IOS_DEV_ONLY_INFO_PLIST_KEYS = [
  'ONEKEY_DEV_BG_HMR',
  'ONEKEY_DEV_VENDOR_SCHEMA_VERSION',
  'ONEKEY_DEV_VENDOR_STRATEGY_VERSION',
  'ONEKEY_NATIVE_CONTRACT_KEY',
];

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `[buildMobileDevShell] Command failed: ${command} ${args[0] || ''}`,
      { cause: result.error },
    );
  }
}

function runForOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `[buildMobileDevShell] Command failed: ${command} ${args[0] || ''}`,
      { cause: result.error },
    );
  }
  return result.stdout.trim();
}

function assertDirectory(directoryPath, label) {
  const stat = fs.lstatSync(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      `[buildMobileDevShell] ${label} is not a regular directory.`,
    );
  }
}

function syncWebEmbedAssets() {
  assertDirectory(WEB_EMBED_BUILD, 'web-embed build');
  const destinations = [
    path.join(MOBILE_ROOT, 'android/app/src/main/assets/web-embed'),
    path.join(MOBILE_ROOT, 'ios/OneKeyWallet/web-embed'),
  ];
  for (const destination of destinations) {
    fs.rmSync(destination, { force: true, recursive: true });
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(WEB_EMBED_BUILD, destination, { recursive: true });
  }
}

function listFiles(directoryPath) {
  const files = [];
  const visit = (currentDirectory) => {
    for (const entry of fs
      .readdirSync(currentDirectory, { withFileTypes: true })
      .toSorted((left, right) => {
        if (left.name < right.name) return -1;
        if (left.name > right.name) return 1;
        return 0;
      })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(entryPath);
    }
  };
  visit(directoryPath);
  return files;
}

function getNativeBuildEnvironment(env = process.env) {
  return {
    ...env,
    ANDROID_CHANNEL: 'direct',
    ENABLE_NATIVE_BACKGROUND_THREAD: 'true',
    NODE_ENV: 'production',
    ONEKEY_DEV_BG_HMR: 'false',
    ONEKEY_DEV_SHELL: 'true',
    ONEKEY_DEV_VENDOR: 'false',
    ONEKEY_STARTUP_PROFILE: 'false',
    SENTRY_DISABLE_AUTO_UPLOAD: 'true',
  };
}

function getIosDevShellInfoPlistEntries(nativeContractKey) {
  if (!/^[0-9a-f]{64}$/u.test(nativeContractKey)) {
    throw new Error('[buildMobileDevShell] Invalid iOS native contract key.');
  }
  return [
    ['ONEKEY_DEV_BG_HMR', 'bool', 'false'],
    [
      'ONEKEY_DEV_VENDOR_SCHEMA_VERSION',
      'integer',
      String(devVendorConfig.SCHEMA_VERSION),
    ],
    [
      'ONEKEY_DEV_VENDOR_STRATEGY_VERSION',
      'integer',
      String(devVendorConfig.STRATEGY_VERSION),
    ],
    ['ONEKEY_NATIVE_CONTRACT_KEY', 'string', nativeContractKey],
  ];
}

function assertIosProductionInfoPlistIsolated() {
  const productionInfoPlist = fs.readFileSync(
    IOS_PRODUCTION_INFO_PLIST,
    'utf8',
  );
  for (const key of IOS_DEV_ONLY_INFO_PLIST_KEYS) {
    if (productionInfoPlist.includes(`<key>${key}</key>`)) {
      throw new Error(
        `[buildMobileDevShell] Production Info.plist contains dev-only key: ${key}`,
      );
    }
  }
}

function injectIosDevShellInfoPlist({ appDirectory, nativeContractKey }) {
  const infoPlistPath = path.join(appDirectory, 'Info.plist');
  const stat = fs.lstatSync(infoPlistPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      '[buildMobileDevShell] iOS Simulator app Info.plist is not a regular file.',
    );
  }
  for (const [key, type, value] of getIosDevShellInfoPlistEntries(
    nativeContractKey,
  )) {
    runChecked('/usr/libexec/PlistBuddy', [
      '-c',
      `Add :${key} ${type} ${value}`,
      infoPlistPath,
    ]);
  }
  runChecked('/usr/bin/plutil', ['-lint', infoPlistPath]);
  return infoPlistPath;
}

function getIosBuildSettings() {
  return [
    'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) DEBUG ONEKEY_DEV_SHELL',
  ];
}

function buildAndroid({ artifactPath }) {
  runChecked(
    './gradlew',
    [
      'assembleProdDebug',
      '-PreactNativeArchitectures=arm64-v8a',
      '--console=plain',
    ],
    {
      cwd: path.join(MOBILE_ROOT, 'android'),
      env: getNativeBuildEnvironment(),
    },
  );
  const outputDirectory = path.join(
    MOBILE_ROOT,
    'android/app/build/outputs/apk/prod/debug',
  );
  const apks = listFiles(outputDirectory).filter((filePath) =>
    filePath.endsWith('.apk'),
  );
  if (apks.length !== 1) {
    throw new Error(
      `[buildMobileDevShell] Expected one Android APK, found ${apks.length}.`,
    );
  }
  const entries = runForOutput('unzip', ['-Z1', apks[0]])
    .split('\n')
    .filter(Boolean);
  const architectures = [
    ...new Set(
      entries
        .map((entry) => entry.match(/^lib\/([^/]+)\//u)?.[1])
        .filter(Boolean),
    ),
  ].toSorted();
  if (architectures.length !== 1 || architectures[0] !== 'arm64-v8a') {
    throw new Error(
      `[buildMobileDevShell] Android APK architectures are invalid: ${architectures.join(',')}.`,
    );
  }
  fs.copyFileSync(apks[0], artifactPath);
}

function installIosPods() {
  const iosDirectory = path.join(MOBILE_ROOT, 'ios');
  runChecked('pod', ['install'], { cwd: iosDirectory });
}

function buildIosSimulator({ artifactPath, nativeContractKey }) {
  if (process.platform !== 'darwin') {
    throw new Error(
      '[buildMobileDevShell] iOS Simulator shell requires macOS.',
    );
  }
  const iosDirectory = path.join(MOBILE_ROOT, 'ios');
  assertIosProductionInfoPlistIsolated();
  runChecked(
    'xcodebuild',
    [
      '-workspace',
      'OneKeyWallet.xcworkspace',
      '-configuration',
      'Debug',
      '-scheme',
      'OneKeyWallet',
      '-destination',
      'generic/platform=iOS Simulator',
      '-derivedDataPath',
      './outputs',
      'ARCHS=arm64',
      'ONLY_ACTIVE_ARCH=YES',
      ...getIosBuildSettings(),
      'CODE_SIGNING_ALLOWED=NO',
    ],
    {
      cwd: iosDirectory,
      env: getNativeBuildEnvironment(),
    },
  );
  const appDirectory = path.join(
    iosDirectory,
    'outputs/Build/Products/Debug-iphonesimulator/OneKeyWallet.app',
  );
  assertDirectory(appDirectory, 'iOS Simulator app');
  injectIosDevShellInfoPlist({ appDirectory, nativeContractKey });
  const architectures = runForOutput('lipo', [
    '-archs',
    path.join(appDirectory, 'OneKeyWallet'),
  ]);
  if (architectures !== 'arm64') {
    throw new Error(
      `[buildMobileDevShell] iOS Simulator app architecture is invalid: ${architectures}.`,
    );
  }
  runChecked('ditto', [
    '-c',
    '-k',
    '--sequesterRsrc',
    '--keepParent',
    appDirectory,
    artifactPath,
  ]);
}

async function buildMobileDevShell({
  outputDirectory = path.join(MOBILE_ROOT, 'out-dir-bundle/dev-shell'),
  platform,
  skipPods = false,
}) {
  if (platform === 'ios' && !skipPods) installIosPods();
  const compatibility = getShellCompatibility({ platform });
  const platformArtifact = getPlatformArtifact(platform);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const artifactPath = path.join(
    path.resolve(outputDirectory),
    platformArtifact.artifactFile,
  );
  fs.rmSync(artifactPath, { force: true });
  syncWebEmbedAssets();
  if (platform === 'android') buildAndroid({ artifactPath });
  else {
    buildIosSimulator({
      artifactPath,
      nativeContractKey: compatibility.nativeContractKey,
    });
  }
  return { artifactPath, compatibility };
}

function parseArgs(argv = process.argv.slice(2)) {
  if (argv[0] !== 'build') {
    throw new Error(
      'Usage: build-mobile-dev-shell.js build --platform <android|ios> [--output <directory>] [--result <file>] [--skip-pods]',
    );
  }
  const values = { skipPods: false };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--skip-pods') {
      values.skipPods = true;
    } else if (!['--output', '--platform', '--result'].includes(argument)) {
      throw new Error(`[buildMobileDevShell] Unknown option: ${argument}`);
    } else {
      values[argument.slice(2)] = argv[index + 1];
      if (!values[argument.slice(2)]) {
        throw new Error(`[buildMobileDevShell] ${argument} requires a value.`);
      }
      index += 1;
    }
  }
  if (!['android', 'ios'].includes(values.platform)) {
    throw new Error('[buildMobileDevShell] --platform must be android or ios.');
  }
  return {
    outputDirectory: values.output,
    platform: values.platform,
    resultPath: values.result,
    skipPods: values.skipPods,
  };
}

async function main() {
  const args = parseArgs();
  const result = await buildMobileDevShell(args);
  if (args.resultPath) {
    await fs.promises.mkdir(path.dirname(path.resolve(args.resultPath)), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.resolve(args.resultPath),
      `${JSON.stringify(result, null, 2)}\n`,
    );
  }
  console.log(result.artifactPath);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  assertIosProductionInfoPlistIsolated,
  buildMobileDevShell,
  getIosBuildSettings,
  getIosDevShellInfoPlistEntries,
  getNativeBuildEnvironment,
  injectIosDevShellInfoPlist,
  parseArgs,
  syncWebEmbedAssets,
};
