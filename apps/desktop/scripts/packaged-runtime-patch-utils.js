const assert = require('assert');
const fs = require('fs');
const path = require('path');

function isDirectory(directoryPath, directoryEntry) {
  if (directoryEntry.isDirectory()) {
    return true;
  }
  if (!directoryEntry.isSymbolicLink()) {
    return false;
  }
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function isPathInside(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    Boolean(relativePath) &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function resolvePathInside(rootPath, candidatePath, description) {
  const realRootPath = fs.realpathSync(rootPath);
  const realCandidatePath = fs.realpathSync(candidatePath);
  assert(
    isPathInside(realRootPath, realCandidatePath),
    `${description} resolves outside runtime node_modules: ${candidatePath} -> ${realCandidatePath}.`,
  );
  return realCandidatePath;
}

function findInstalledPackageInstances(nodeModulesRoot, targetPackageNames) {
  const packageInstances = [];
  const visitedPackageRoots = new Set();

  function inspectPackage(packageRoot) {
    let realPackageRoot;
    try {
      realPackageRoot = fs.realpathSync(packageRoot);
    } catch {
      return;
    }
    resolvePathInside(nodeModulesRoot, realPackageRoot, 'Installed package');
    if (visitedPackageRoots.has(realPackageRoot)) {
      return;
    }
    visitedPackageRoots.add(realPackageRoot);

    const packageJsonPath = path.join(realPackageRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return;
    }

    let packageMetadata;
    try {
      packageMetadata = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (error) {
      assert.fail(
        `Invalid package metadata at ${packageJsonPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (targetPackageNames.has(packageMetadata.name)) {
      packageInstances.push({
        packageName: packageMetadata.name,
        packageRoot: realPackageRoot,
        version: packageMetadata.version,
      });
    }
    scanNodeModules(path.join(realPackageRoot, 'node_modules'));
  }

  function scanNodeModules(nodeModulesPath) {
    if (!fs.existsSync(nodeModulesPath)) {
      return;
    }
    for (const directoryEntry of fs.readdirSync(nodeModulesPath, {
      withFileTypes: true,
    })) {
      const entryPath = path.join(nodeModulesPath, directoryEntry.name);
      if (
        directoryEntry.name !== '.bin' &&
        isDirectory(entryPath, directoryEntry)
      ) {
        if (!directoryEntry.name.startsWith('@')) {
          inspectPackage(entryPath);
        } else {
          for (const scopedEntry of fs.readdirSync(entryPath, {
            withFileTypes: true,
          })) {
            const scopedPackagePath = path.join(entryPath, scopedEntry.name);
            if (isDirectory(scopedPackagePath, scopedEntry)) {
              inspectPackage(scopedPackagePath);
            }
          }
        }
      }
    }
  }

  scanNodeModules(nodeModulesRoot);
  return packageInstances;
}

function groupPackageInstancesByName(packageInstances) {
  const packageInstancesByName = new Map();
  for (const packageInstance of packageInstances) {
    const instances =
      packageInstancesByName.get(packageInstance.packageName) || [];
    instances.push(packageInstance);
    packageInstancesByName.set(packageInstance.packageName, instances);
  }
  return packageInstancesByName;
}

module.exports = {
  findInstalledPackageInstances,
  groupPackageInstancesByName,
  resolvePathInside,
};
