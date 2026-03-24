// Jest globalTeardown for harness tests.
// Clears the harness-mode flags written by globalSetup.mjs so that
// reused emulators/simulators return to normal boot-recovery behavior
// after the test session ends.

import { execFileSync } from 'node:child_process';

function clearAndroidHarnessFlag() {
  execFileSync(
    'adb',
    [
      'shell',
      'run-as',
      'so.onekey.app.wallet',
      'rm',
      '-f',
      'files/harness_mode',
    ],
    { stdio: 'pipe', timeout: 5000 },
  );
  // Reset boot-fail counter so harness restarts don't trigger recovery
  // on the next normal launch. SharedPrefs file: onekey_recovery.xml,
  // key: consecutive_boot_fail_count.
  try {
    const key = 'consecutive_boot_fail_count';
    const sedCmd = `sed -i 's/${key}" value="[0-9]*/${key}" value="0/' shared_prefs/onekey_recovery.xml`;
    execFileSync(
      'adb',
      ['shell', 'run-as', 'so.onekey.app.wallet', 'sh', '-c', sedCmd],
      { stdio: 'pipe', timeout: 5000 },
    );
  } catch (e) {
    console.log(
      `[harness-globalTeardown] Android boot-fail counter reset failed: ${e.message}`,
    );
  }
  console.log('[harness-globalTeardown] Android harness_mode flag cleared');
}

function clearIOSHarnessFlag() {
  const out = execFileSync(
    'xcrun',
    ['simctl', 'list', 'devices', 'booted', '-j'],
    {
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  const { devices } = JSON.parse(out);
  for (const runtime of Object.values(devices)) {
    for (const device of runtime) {
      if (device.state === 'Booted') {
        let cleanupOk = true;
        try {
          execFileSync(
            'xcrun',
            [
              'simctl',
              'spawn',
              device.udid,
              'defaults',
              'delete',
              'so.onekey.wallet',
              'onekey_harness_mode',
            ],
            { stdio: 'pipe', timeout: 5000 },
          );
        } catch (e) {
          // "Domain not found" or "key not found" are expected when key was never set
          console.log(
            `[harness-globalTeardown] iOS harness_mode delete failed on ${device.name}: ${e.message}`,
          );
          cleanupOk = false;
        }
        try {
          execFileSync(
            'xcrun',
            [
              'simctl',
              'spawn',
              device.udid,
              'defaults',
              'delete',
              'so.onekey.wallet',
              'onekey_consecutive_boot_fail_count',
            ],
            { stdio: 'pipe', timeout: 5000 },
          );
        } catch (e) {
          console.log(
            `[harness-globalTeardown] iOS boot_fail_count delete failed on ${device.name}: ${e.message}`,
          );
          cleanupOk = false;
        }
        console.log(
          `[harness-globalTeardown] iOS cleanup ${cleanupOk ? 'done' : 'partial'} on ${device.name} (${device.udid})`,
        );
      }
    }
  }
}

export default async function globalTeardown() {
  try {
    clearAndroidHarnessFlag();
  } catch (e) {
    // No Android device/emulator — expected on iOS runs
    console.log(
      `[harness-globalTeardown] Android cleanup skipped: ${e.message}`,
    );
  }
  try {
    clearIOSHarnessFlag();
  } catch (e) {
    // No booted iOS simulator — expected on Android runs
    console.log(`[harness-globalTeardown] iOS cleanup skipped: ${e.message}`);
  }
}
