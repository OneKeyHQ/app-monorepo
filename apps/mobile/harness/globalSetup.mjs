// Jest globalSetup for harness tests.
// Writes a harness-mode flag into the native layer so the boot-recovery
// check is skipped for the entire test session. Without this, the app's
// crash-recovery page blocks React Native from starting after a few
// app restarts (which are normal during harness testing).

import { execFileSync } from 'node:child_process';

function setAndroidHarnessFlag() {
  // Create a marker file in the app's data directory.
  // MainApplication.java checks for this file and skips recovery.
  //
  // Split into two adb calls because `adb shell` concatenates all
  // arguments into a single string for the remote shell, which causes
  // `&&` to be interpreted as a command separator — breaking the
  // `run-as` scope.
  const adbOpts = { stdio: 'pipe', timeout: 5000 };
  execFileSync(
    'adb',
    ['shell', 'run-as', 'so.onekey.app.wallet', 'mkdir', '-p', 'files'],
    adbOpts,
  );
  execFileSync(
    'adb',
    ['shell', 'run-as', 'so.onekey.app.wallet', 'touch', 'files/harness_mode'],
    adbOpts,
  );
  console.log('[harness-globalSetup] Android harness_mode flag set');
}

/** @returns {boolean} true if at least one booted simulator was updated */
function setIOSHarnessFlag() {
  // Write a UserDefaults flag on all booted iOS simulators.
  // AppDelegate.swift checks for this flag and skips recovery.
  const out = execFileSync(
    'xcrun',
    ['simctl', 'list', 'devices', 'booted', '-j'],
    {
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  const { devices } = JSON.parse(out);
  let flagSet = false;
  for (const runtime of Object.values(devices)) {
    for (const device of runtime) {
      if (device.state === 'Booted') {
        try {
          execFileSync(
            'xcrun',
            [
              'simctl',
              'spawn',
              device.udid,
              'defaults',
              'write',
              'so.onekey.wallet',
              'onekey_harness_mode',
              '-bool',
              'YES',
            ],
            { stdio: 'pipe', timeout: 5000 },
          );
          console.log(
            `[harness-globalSetup] iOS harness_mode flag set on ${device.name} (${device.udid})`,
          );
          flagSet = true;
        } catch (e) {
          console.log(
            `[harness-globalSetup] iOS flag failed on ${device.name}: ${e.message}`,
          );
        }
      }
    }
  }
  return flagSet;
}

export default async function globalSetup() {
  // HARNESS_PLATFORM narrows which platform MUST succeed (set by
  // platform-specific npm scripts, e.g. harness:test:android).
  const targetPlatform = (process.env.HARNESS_PLATFORM || '').toLowerCase();

  let androidOk = false;
  let iosOk = false;
  try {
    setAndroidHarnessFlag();
    androidOk = true;
  } catch (e) {
    // No Android device/emulator connected — expected on iOS runs
    console.log(`[harness-globalSetup] Android flag skipped: ${e.message}`);
  }
  try {
    iosOk = setIOSHarnessFlag();
    if (!iosOk) {
      console.log('[harness-globalSetup] iOS: no booted simulators found');
    }
  } catch (e) {
    // No booted iOS simulator — expected on Android runs
    console.log(`[harness-globalSetup] iOS flag skipped: ${e.message}`);
  }
  console.log(
    `[harness-globalSetup] Result: Android=${androidOk ? 'ok' : 'skipped'}, iOS=${iosOk ? 'ok' : 'skipped'}`,
  );

  // When a specific platform is targeted, fail fast if it didn't succeed —
  // a success on the *other* platform must not mask the real failure.
  if (targetPlatform === 'android' && !androidOk) {
    throw new Error(
      '[harness-globalSetup] Android is the target runner but flag setup failed',
    );
  }
  if (targetPlatform === 'ios' && !iosOk) {
    throw new Error(
      '[harness-globalSetup] iOS is the target runner but flag setup failed',
    );
  }
  if (!targetPlatform && !androidOk && !iosOk) {
    console.warn(
      '[harness-globalSetup] WARNING: Failed to set harness flag on both platforms. ' +
        'Boot recovery may block test startup.',
    );
  }
}
