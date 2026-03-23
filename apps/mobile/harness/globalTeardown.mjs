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
        console.log(
          `[harness-globalTeardown] iOS harness_mode flag cleared on ${device.name} (${device.udid})`,
        );
      }
    }
  }
}

export default async function globalTeardown() {
  try {
    clearAndroidHarnessFlag();
  } catch {
    // No Android device/emulator — expected on iOS runs
  }
  try {
    clearIOSHarnessFlag();
  } catch {
    // No booted iOS simulator — expected on Android runs
  }
}
