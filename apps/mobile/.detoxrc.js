// Detox config lives alongside the native app workspace so `yarn workspace @onekeyhq/mobile detox ...`
// works without extra flags.

const path = require('path');
const { execSync } = require('child_process');

function tryDetectSimulatorDeviceType() {
  try {
    const raw = execSync('/usr/bin/xcrun simctl list -j devices available', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8');
    const json = JSON.parse(raw);
    const devicesByRuntime = json?.devices || {};
    const all = Object.values(devicesByRuntime).flat();
    const iphoneNames = all
      .filter((d) => d && d.isAvailable !== false && typeof d.name === 'string')
      .map((d) => d.name)
      .filter((n) => n.startsWith('iPhone '));

    const unique = Array.from(new Set(iphoneNames));

    // Prefer a stable "mainline" iPhone type if it exists on the machine.
    const preferred = [
      // Prefer the dedicated perf simulator model if available.
      'iPhone 16e',
      'iPhone 17',
      'iPhone 16',
      'iPhone 15',
      'iPhone 14',
      'iPhone 13',
      'iPhone 12',
      'iPhone 11',
      'iPhone SE (3rd generation)',
    ];

    for (const name of preferred) {
      if (unique.includes(name)) return name;
    }

    return unique[0] || null;
  } catch {
    return null;
  }
}

function tryDetectAndroidAvdName() {
  try {
    // Prefer listing from the Android emulator tool if available.
    const raw = execSync('emulator -list-avds', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString('utf8')
      .trim();
    if (raw) return raw.split('\n')[0].trim() || null;
  } catch {
    // ignore
  }

  // Fallback: try to detect from ~/.android/avd/*.avd folders.
  try {
    const fs = require('fs');
    const os = require('os');
    const avdDir = path.join(os.homedir(), '.android', 'avd');
    const entries = fs.readdirSync(avdDir, { withFileTypes: true });
    const names = entries
      .filter((e) => e.isDirectory() && e.name.endsWith('.avd'))
      .map((e) => e.name.replace(/\.avd$/, ''));
    return names[0] || null;
  } catch {
    return null;
  }
}

const deviceName =
  process.env.DETOX_DEVICE_NAME ||
  tryDetectSimulatorDeviceType() ||
  'iPhone 15';
const deviceUdid = process.env.DETOX_DEVICE_UDID || null;

const androidAvdName =
  process.env.DETOX_ANDROID_AVD_NAME ||
  process.env.ANDROID_AVD_NAME ||
  tryDetectAndroidAvdName() ||
  null;

module.exports = {
  testRunner: {
    args: {
      // When running via `yarn workspace @onekeyhq/mobile ...`, the cwd is `apps/mobile`,
      // and `node_modules/.bin` inside this workspace may not contain `jest`.
      // Use the repo-root Jest entrypoint explicitly.
      $0: 'node ../../node_modules/jest/bin/jest.js',
      config: 'e2e/jest.config.js',
    },
    jest: {
      // Jest "setup" timeout (not the per-test timeout).
      setupTimeout: 5 * 60 * 1000,
    },
  },

  apps: {
    'ios.sim.debug': {
      type: 'ios.app',
      binaryPath: path.join(
        __dirname,
        'ios/build/detox/Build/Products/Debug-iphonesimulator/OneKeyWallet.app',
      ),
      // Build a simulator Debug app. We intentionally avoid binding to a specific simulator name.
      build:
        'xcodebuild ' +
        '-workspace ios/OneKeyWallet.xcworkspace ' +
        '-scheme OneKeyWallet ' +
        '-configuration Debug ' +
        '-sdk iphonesimulator ' +
        "-destination 'generic/platform=iOS Simulator' " +
        '-derivedDataPath ios/build/detox',
    },

    // Offline bundle (no Metro) configuration.
    // AppDelegate.swift uses `main.jsbundle` outside DEBUG, so this avoids "Could not connect to development server".
    'ios.sim.release': {
      type: 'ios.app',
      binaryPath: path.join(
        __dirname,
        'ios/build/detox/Build/Products/Release-iphonesimulator/OneKeyWallet.app',
      ),
      build:
        // Ensure perf monitor is enabled at bundle-time for Release bundles.
        'PERF_MONITOR_ENABLED=1 SENTRY_DISABLE_AUTO_UPLOAD=true ' +
        'xcodebuild ' +
        '-workspace ios/OneKeyWallet.xcworkspace ' +
        '-scheme OneKeyWallet ' +
        '-configuration Release ' +
        '-sdk iphonesimulator ' +
        "-destination 'generic/platform=iOS Simulator' " +
        '-derivedDataPath ios/build/detox',
    },

    'android.emu.debug': {
      type: 'android.apk',
      binaryPath: path.join(
        __dirname,
        'android/app/build/outputs/apk/prod/debug/app-prod-debug.apk',
      ),
      testBinaryPath: path.join(
        __dirname,
        'android/app/build/outputs/apk/androidTest/prod/debug/app-prod-debug-androidTest.apk',
      ),
      build:
        'cd android && ' +
        './gradlew assembleProdDebug assembleProdDebugAndroidTest -DtestBuildType=debug',
    },

    'android.emu.release': {
      type: 'android.apk',
      binaryPath: path.join(
        __dirname,
        'android/app/build/outputs/apk/prod/release/app-prod-release.apk',
      ),
      // Note: this project generates androidTest APKs only for Debug build type.
      // We still test the Release app with the Debug androidTest APK (Detox instrumentation),
      // which is sufficient for running Detox JS tests and keeps the build wiring simple.
      testBinaryPath: path.join(
        __dirname,
        'android/app/build/outputs/apk/androidTest/prod/debug/app-prod-debug-androidTest.apk',
      ),
      build:
        'cd android && ' +
        // Ensure perf monitor is enabled at bundle-time for Release bundles.
        'PERF_MONITOR_ENABLED=1 SENTRY_DISABLE_AUTO_UPLOAD=true ' +
        './gradlew assembleProdRelease assembleProdDebugAndroidTest -DtestBuildType=debug',
    },
  },

  devices: {
    simulator: {
      type: 'ios.simulator',
      device: deviceUdid ? { id: deviceUdid } : { type: deviceName },
    },

    androidEmulator: {
      type: 'android.emulator',
      device: androidAvdName ? { avdName: androidAvdName } : {},
    },
  },

  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.sim.debug',
      // Metro must be started with PERF_MONITOR_ENABLED=1 so the value isn't "inlined" incorrectly.
      // Keep this minimal and reuse the existing workspace script.
      // We run it via a wrapper so Detox can terminate it reliably on shutdown (avoid hung jobs).
      start: 'node e2e/start-metro.js',
    },

    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.sim.release',
      // No Metro start: Release bundle is embedded in the app (main.jsbundle).
    },

    'android.emu.debug': {
      device: 'androidEmulator',
      app: 'android.emu.debug',
      start: 'node e2e/start-metro.js',
    },

    'android.emu.release': {
      device: 'androidEmulator',
      app: 'android.emu.release',
      // No Metro start: Release bundle is embedded in the app.
    },
  },
};
