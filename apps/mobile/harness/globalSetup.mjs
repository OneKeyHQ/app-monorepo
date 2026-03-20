// Jest globalSetup for harness tests.
// Resets the native boot-recovery counter before the harness launches the app,
// preventing the recovery page from blocking test execution.
//
// The counter accumulates when the app is force-killed (as happens after each
// harness test file), and after 3 consecutive "crashes" the native layer shows
// a recovery page instead of starting React Native.

import { execFileSync } from 'node:child_process';

function resetAndroid() {
  // Remove the SharedPreferences file that stores the boot fail counter.
  // File: onekey_recovery.xml, key: consecutive_boot_fail_count
  execFileSync(
    'adb',
    ['shell', 'run-as', 'so.onekey.app.wallet', 'rm', '-f', 'shared_prefs/onekey_recovery.xml'],
    { stdio: 'pipe', timeout: 5000 },
  );
  console.log('[harness-globalSetup] Android boot recovery counter reset');
}

function resetIOS() {
  // Reset UserDefaults key on all booted iOS simulators.
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
            'onekey_consecutive_boot_fail_count', '-integer', '0',
          ],
          { stdio: 'pipe', timeout: 5000 },
        );
        console.log(
          `[harness-globalSetup] iOS boot recovery counter reset on ${device.name} (${device.udid})`,
        );
      }
    }
  }
}

export default async function globalSetup() {
  // Try both platforms — one will succeed, the other will silently fail.
  try {
    resetAndroid();
  } catch {
    // No Android device/emulator connected — expected on iOS runs
  }
  try {
    resetIOS();
  } catch {
    // No booted iOS simulator — expected on Android runs
  }
}
