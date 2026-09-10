#!/usr/bin/env node
/* eslint-disable no-console */
// Reconnect an already-installed debug build to the running Metro, without
// rebuilding anything.
//
// `expo run:android` does three things: build native, install, and wire the
// device to Metro. Only the third one breaks in day-to-day use -- the
// `adb reverse tcp:8081` mapping disappears whenever USB re-enumerates, the
// adb server restarts, or the app is reinstalled, and a Metro restart drops
// every existing app connection ("No connected targets"). Both symptoms look
// like a broken app, and the only bundled cure has been a multi-minute native
// rebuild for the sake of a 0.1s adb call. This is that call, plus the relaunch
// that makes the app reconnect.
//
//   node apps/mobile/scripts/reattach-android.js [--port 8081] [--no-restart]

const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const port = argValue('--port', '8081');
const restart = !args.includes('--no-restart');
const PACKAGE = 'so.onekey.app.wallet';
const ACTIVITY = `${PACKAGE}/.MainActivity`;

function adb(adbArgs, { serial } = {}) {
  const full = serial ? ['-s', serial].concat(adbArgs) : adbArgs;
  return execFileSync('adb', full, { encoding: 'utf8' });
}

function connectedSerials() {
  const out = adb(['devices']);
  return out
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.endsWith('\tdevice'))
    .map((line) => line.split('\t')[0]);
}

function reattach(serial) {
  console.log(`[reattach] ${serial}: adb reverse tcp:${port}`);
  adb(['reverse', `tcp:${port}`, `tcp:${port}`], { serial });

  const list = adb(['reverse', '--list'], { serial });
  if (!list.includes(`tcp:${port} tcp:${port}`)) {
    console.error(`[reattach] ${serial}: reverse mapping did not stick`);
    process.exitCode = 1;
    return;
  }
  console.log(`[reattach] ${serial}: mapping ok`);

  if (!restart) {
    return;
  }
  // Metro only talks to apps that connected after it started, so an app left
  // over from a previous Metro has to be relaunched, not just reloaded.
  console.log(`[reattach] ${serial}: restarting ${PACKAGE}`);
  try {
    adb(['shell', 'am', 'force-stop', PACKAGE], { serial });
    adb(['shell', 'am', 'start', '-n', ACTIVITY], { serial });
  } catch (e) {
    console.error(
      `[reattach] ${serial}: could not restart the app`,
      (e && e.message) || e,
    );
    process.exitCode = 1;
  }
}

function main() {
  let serials;
  try {
    serials = connectedSerials();
  } catch (e) {
    console.error('[reattach] adb is not available', (e && e.message) || e);
    process.exitCode = 1;
    return;
  }
  if (serials.length === 0) {
    console.error('[reattach] no device in "adb devices"; check the USB cable');
    process.exitCode = 1;
    return;
  }
  serials.forEach(reattach);
  console.log(
    '[reattach] done. If the bundle is cold, run "yarn prewarm:android" too.',
  );
}

main();
