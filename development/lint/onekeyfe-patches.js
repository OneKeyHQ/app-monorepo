#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PATCHES_DIR = 'patches';
const YARN_LOCK_PATH = 'yarn.lock';
const ONEKEY_SCOPE = '@onekeyfe/';
const APP_MODULES_REPO_URL = 'https://github.com/OneKeyHQ/app-modules';

// Allowlist rather than a native extension denylist: C/C++ sources, Gradle and
// CocoaPods specs, and Nitro generated bindings are native code as well.
const PATCHABLE_FILE_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/u;

const DIFF_HEADER_RE = /^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/gmu;

function getPackageNameFromLocator(locator) {
  const separatorIndex = locator.indexOf('@', 1);
  return separatorIndex === -1 ? locator : locator.slice(0, separatorIndex);
}

// Maps each dependency name (npm aliases included) to the packages it
// resolves to, e.g. `react-native-pager-view` ->
// `@onekeyfe/react-native-pager-view@3.0.140`.
function indexLockfilePackages(lockfileSource) {
  const index = new Map();
  let entry = null;

  const flushEntry = () => {
    if (!entry?.resolvedName) {
      return;
    }
    for (const dependencyName of entry.dependencyNames) {
      const resolutions = index.get(dependencyName) ?? [];
      resolutions.push({
        resolvedName: entry.resolvedName,
        version: entry.version,
      });
      index.set(dependencyName, resolutions);
    }
  };

  for (const line of lockfileSource.split(/\r?\n/u)) {
    if (/^\S.*:$/u.test(line)) {
      flushEntry();
      entry = {
        dependencyNames: new Set(
          line
            .slice(0, -1)
            .replace(/^"|"$/gu, '')
            .split(', ')
            .map(getPackageNameFromLocator),
        ),
        resolvedName: null,
        version: null,
      };
    } else if (entry) {
      const field = /^ {2}(version|resolution): "?([^"]+)"?$/u.exec(line);
      if (field?.[1] === 'version') {
        entry.version = field[2];
      } else if (field?.[1] === 'resolution') {
        entry.resolvedName = getPackageNameFromLocator(field[2]);
      }
    }
  }
  flushEntry();

  return index;
}

function getInstalledPackageName(filePath) {
  const segments = filePath.split('/');
  const nodeModulesIndex = segments.lastIndexOf('node_modules');
  if (nodeModulesIndex === -1) {
    return null;
  }
  const [scopeOrName, name] = segments.slice(nodeModulesIndex + 1);
  if (!scopeOrName?.startsWith('@')) {
    return scopeOrName || null;
  }
  return name ? `${scopeOrName}/${name}` : null;
}

// patch-package names patches `<scope>+<name>+<version>[+<seq>+<desc>]`,
// joining nested packages with `++`.
function getPatchedVersion(patchFileName, packageName) {
  const lastSegment = patchFileName
    .replace(/(?:\.dev)?\.patch$/u, '')
    .split('++')
    .at(-1);
  const prefix = `${packageName.replace('/', '+')}+`;
  if (!lastSegment.startsWith(prefix)) {
    return null;
  }
  return lastSegment.slice(prefix.length).split('+')[0];
}

function resolveOneKeyPackageName(packageName, version, lockfileIndex) {
  if (packageName.startsWith(ONEKEY_SCOPE)) {
    return packageName;
  }
  const resolutions = lockfileIndex.get(packageName) ?? [];
  const versionResolutions = resolutions.filter(
    (resolution) => resolution.version === version,
  );
  const candidates =
    versionResolutions.length > 0 ? versionResolutions : resolutions;
  return (
    candidates.find(({ resolvedName }) => resolvedName.startsWith(ONEKEY_SCOPE))
      ?.resolvedName ?? null
  );
}

function getPatchedFilePaths(patchSource) {
  const filePaths = new Set();
  for (const [, fromPath, toPath] of patchSource.matchAll(DIFF_HEADER_RE)) {
    filePaths.add(fromPath);
    filePaths.add(toPath);
  }
  return [...filePaths];
}

function findOneKeyNativePatchViolations({ lockfileSource, patches }) {
  const lockfileIndex = indexLockfilePackages(lockfileSource);

  return patches.flatMap(({ fileName, source }) => {
    const violationsByPackage = new Map();

    for (const filePath of getPatchedFilePaths(source)) {
      const installedName = getInstalledPackageName(filePath);
      const packageName =
        installedName && !PATCHABLE_FILE_RE.test(filePath)
          ? resolveOneKeyPackageName(
              installedName,
              getPatchedVersion(fileName, installedName),
              lockfileIndex,
            )
          : null;

      if (packageName) {
        const violation = violationsByPackage.get(installedName) ?? {
          filePaths: [],
          installedName,
          packageName,
          patchFileName: fileName,
        };
        violation.filePaths.push(filePath);
        violationsByPackage.set(installedName, violation);
      }
    }

    return [...violationsByPackage.values()];
  });
}

function formatViolation({
  filePaths,
  installedName,
  packageName,
  patchFileName,
}) {
  const packageLabel =
    installedName === packageName
      ? packageName
      : `${installedName} -> ${packageName}`;
  return [
    `- ${PATCHES_DIR}/${patchFileName} (${packageLabel})`,
    ...filePaths.map((filePath) => `    ${filePath}`),
  ].join('\n');
}

function formatViolationReport(violations) {
  return [
    `[onekeyfe-patches] failed: ${ONEKEY_SCOPE}* patches may only change .js/.jsx/.ts/.tsx files. Open a PR in ${APP_MODULES_REPO_URL} and publish a new release for these changes instead:`,
    ...violations.map(formatViolation),
    `[onekeyfe-patches] Native code (Objective-C, Swift, Java, Kotlin, C/C++) and build files ship only from ${APP_MODULES_REPO_URL} releases. Once released, upgrade the dependency here and remove these changes from the patch.`,
  ].join('\n');
}

function main() {
  const rootDir = path.resolve(__dirname, '../..');
  const patchesDir = path.join(rootDir, PATCHES_DIR);
  const patches = fs
    .readdirSync(patchesDir)
    .filter((fileName) => fileName.endsWith('.patch'))
    .toSorted()
    .map((fileName) => ({
      fileName,
      source: fs.readFileSync(path.join(patchesDir, fileName), 'utf8'),
    }));

  const violations = findOneKeyNativePatchViolations({
    lockfileSource: fs.readFileSync(path.join(rootDir, YARN_LOCK_PATH), 'utf8'),
    patches,
  });

  if (violations.length > 0) {
    console.error(formatViolationReport(violations));
    process.exitCode = 1;
    return;
  }

  console.log(`[onekeyfe-patches] passed (${patches.length} patches)`);
}

if (require.main === module) {
  main();
}

module.exports = {
  findOneKeyNativePatchViolations,
  indexLockfilePackages,
};
