#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PODFILE_LOCK_PATH = 'apps/mobile/ios/Podfile.lock';
const IOS_DEV_SHELL_WORKFLOW_PATH =
  '.github/workflows/mobile-dev-shell-ios-simulator.yml';

function extractSingleVersion(source, pattern, label, errors) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    errors.push(`${label} must declare exactly one CocoaPods version`);
    return null;
  }
  return matches[0][1];
}

function checkCocoaPodsVersions({ lockfileSource, workflowSource }) {
  const errors = [];
  const lockfileVersion = extractSingleVersion(
    lockfileSource,
    /^COCOAPODS:\s+(\d+\.\d+\.\d+)\s*$/gmu,
    PODFILE_LOCK_PATH,
    errors,
  );
  const installedVersion = extractSingleVersion(
    workflowSource,
    /^\s*gem install cocoapods -v ['"]?(\d+\.\d+\.\d+)['"]?\s*$/gmu,
    IOS_DEV_SHELL_WORKFLOW_PATH,
    errors,
  );
  const activatedVersion = extractSingleVersion(
    workflowSource,
    /^\s*pod _(\d+\.\d+\.\d+)_ install --deployment\s*$/gmu,
    IOS_DEV_SHELL_WORKFLOW_PATH,
    errors,
  );

  if (
    installedVersion &&
    activatedVersion &&
    installedVersion !== activatedVersion
  ) {
    errors.push(
      `CocoaPods install version ${installedVersion} does not match activated version ${activatedVersion}`,
    );
  }
  if (
    lockfileVersion &&
    activatedVersion &&
    lockfileVersion !== activatedVersion
  ) {
    errors.push(
      `${PODFILE_LOCK_PATH} was generated with CocoaPods ${lockfileVersion}, but CI activates ${activatedVersion}`,
    );
  }

  return {
    errors,
    versions: {
      activated: activatedVersion,
      installed: installedVersion,
      lockfile: lockfileVersion,
    },
  };
}

function main() {
  const rootDir = path.resolve(__dirname, '../..');
  const result = checkCocoaPodsVersions({
    lockfileSource: fs.readFileSync(
      path.join(rootDir, PODFILE_LOCK_PATH),
      'utf8',
    ),
    workflowSource: fs.readFileSync(
      path.join(rootDir, IOS_DEV_SHELL_WORKFLOW_PATH),
      'utf8',
    ),
  });

  if (result.errors.length > 0) {
    console.error(`[podfile] failed:\n- ${result.errors.join('\n- ')}`);
    const targetVersion =
      result.versions.activated ?? result.versions.installed;
    console.error(
      `[podfile] Upgrade CocoaPods${
        targetVersion ? ` to ${targetVersion}` : ''
      } and regenerate ${PODFILE_LOCK_PATH}.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[podfile] passed (CocoaPods ${result.versions.lockfile})`);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkCocoaPodsVersions,
};
