/* eslint-disable onekey/no-raw-error -- Standalone Node build script. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const plist = require('@expo/plist').default;

const iosDirectory = path.resolve(__dirname, '../ios');
const versionKeys = ['CFBundleShortVersionString', 'CFBundleVersion'];

function syncLiveActivityVersion({
  platform,
  appPlistPath = path.join(iosDirectory, 'OneKeyWallet/Info.plist'),
  activityPlistPath = path.join(iosDirectory, 'LiveActivity/Info.plist'),
}) {
  if (platform === 'android') return;
  if (platform !== 'ios') {
    throw new Error('EAS_BUILD_PLATFORM must be ios or android');
  }

  const app = plist.parse(fs.readFileSync(appPlistPath, 'utf8'));
  const activity = plist.parse(fs.readFileSync(activityPlistPath, 'utf8'));

  for (const key of versionKeys) {
    const value = app[key];
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value !== value.trim() ||
      value.includes('$(')
    ) {
      throw new Error(`Invalid ${key} in OneKeyWallet Info.plist`);
    }
    if (typeof activity[key] !== 'string') {
      throw new Error(`Missing ${key} in LiveActivity Info.plist`);
    }
  }

  for (const key of versionKeys) activity[key] = app[key];
  const output = plist.build(activity);
  const mode = fs.statSync(activityPlistPath).mode & 0o777;
  const temporaryPath = path.join(
    path.dirname(activityPlistPath),
    `.live-activity-plist-${crypto.randomUUID()}.tmp`,
  );
  const descriptor = fs.openSync(temporaryPath, 'wx', mode);
  try {
    try {
      fs.writeFileSync(descriptor, output);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, activityPlistPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

if (require.main === module) {
  syncLiveActivityVersion({ platform: process.env.EAS_BUILD_PLATFORM });
}

module.exports = { syncLiveActivityVersion };
