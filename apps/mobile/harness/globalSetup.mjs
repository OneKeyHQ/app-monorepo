// Jest globalSetup for harness tests.
// Writes a harness-mode flag into the native layer so the boot-recovery
// check is skipped for the entire test session. Without this, the app's
// crash-recovery page blocks React Native from starting after a few
// app restarts (which are normal during harness testing).

import { execFileSync } from 'node:child_process';

function setAndroidHarnessFlag() {
  // Create a marker file in the app's data directory.
  // MainApplication.java checks for this file and skips recovery.
  execFileSync(
    'adb',
    [
      'shell', 'run-as', 'so.onekey.app.wallet',
      'sh', '-c', 'mkdir -p files && touch files/harness_mode',
    ],
    { stdio: 'pipe', timeout: 5000 },
  );
  console.log('[harness-globalSetup] Android harness_mode flag set');
}

function setIOSHarnessFlag() {
  // Write a UserDefaults flag on all booted iOS simulators.
  // AppDelegate.swift checks for this flag and skips recovery.
  const out = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  const { devices } = JSON.parse(out);
  for (const runtime of Object.values(devices)) {
    for (const device of runtime) {
      if (device.state === 'Booted') {
        execFileSync(
          'xcrun',
          [
            'simctl', 'spawn', device.udid,
            'defaults', 'write', 'so.onekey.wallet',
            'onekey_harness_mode', '-bool', 'YES',
          ],
          { stdio: 'pipe', timeout: 5000 },
        );
        console.log(
          `[harness-globalSetup] iOS harness_mode flag set on ${device.name} (${device.udid})`,
        );
      }
    }
  }
}

export default async function globalSetup() {
  // Try both platforms — one will succeed, the other will silently fail.
  try {
    setAndroidHarnessFlag();
  } catch {
    // No Android device/emulator connected — expected on iOS runs
  }
  try {
    setIOSHarnessFlag();
  } catch {
    // No booted iOS simulator — expected on Android runs
  }
}
