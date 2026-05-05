/* eslint-disable onekey/no-raw-error */
/*
 * Thin dispatcher kept for backward compatibility with hard-coded callers
 * (Xcode shellScript, android/app/build.gradle, development/scripts/*.sh,
 * `yarn app:build-bundle`). Real logic lives in:
 *   - build-bundle-base.js   shared helpers / pipelines
 *   - build-ios-bundle.js    iOS-specific bundle pipeline (CI uses this directly)
 *   - build-android-bundle.js Android-specific bundle pipeline (CI uses this directly)
 *
 * Usage:
 *   node build-bundle.js                  # builds both ios and android (legacy)
 *   node build-bundle.js --platform ios   # ios only
 *   node build-bundle.js --platform=android  # android only
 */
const { buildAndroidBundle } = require('./build-android-bundle');
const { buildWebEmbed, cleanBundleOutput } = require('./build-bundle-base');
const { buildIOSBundle } = require('./build-ios-bundle');

const resolvePlatformArg = () => {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') {
      return argv[i + 1];
    }
    if (arg.startsWith('--platform=')) {
      return arg.slice('--platform='.length);
    }
  }
  return undefined;
};

async function main() {
  const platform = resolvePlatformArg();
  // For "build everything in one process" callers, do a full clean + shared
  // web-embed once, then run both platforms sequentially. Per-platform CI
  // entries (build-ios-bundle.js / build-android-bundle.js) handle their own
  // scoped cleanup so they don't stomp on each other in parallel jobs.
  if (!platform) {
    await cleanBundleOutput();
    await buildWebEmbed();
    await buildIOSBundle();
    await buildAndroidBundle();
    return;
  }
  if (platform === 'ios') {
    await cleanBundleOutput({ platform: 'ios' });
    await buildWebEmbed();
    await buildIOSBundle();
    return;
  }
  if (platform === 'android') {
    await cleanBundleOutput({ platform: 'android' });
    await buildWebEmbed();
    await buildAndroidBundle();
    return;
  }
  throw new Error(
    `[build-bundle] unknown --platform value: ${platform} (expected ios | android)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
