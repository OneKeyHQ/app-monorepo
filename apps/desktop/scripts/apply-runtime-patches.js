const fs = require('fs');
const path = require('path');

const {
  findInstalledPackageInstances,
  groupPackageInstancesByName,
} = require('./packaged-runtime-patch-utils');
const { packagedRuntimePatches } = require('./packaged-runtime-patches');

function failPatch(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readPackageMetadata(packageJsonPath, description) {
  if (!fs.existsSync(packageJsonPath)) {
    failPatch(`${description} is missing: ${packageJsonPath}.`);
  }
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    failPatch(
      `${description} is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

const desktopPackageRoot = path.join(__dirname, '..');
const runtimeAppRoot = path.join(desktopPackageRoot, 'app');
const runtimeNodeModulesRoot = path.join(runtimeAppRoot, 'node_modules');
let runtimePackageInstances;
try {
  runtimePackageInstances = findInstalledPackageInstances(
    runtimeNodeModulesRoot,
    new Set(packagedRuntimePatches.map(({ packageName }) => packageName)),
  );
} catch (error) {
  failPatch(
    `Cannot inspect runtime dependencies under ${runtimeNodeModulesRoot}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
const runtimePackageInstancesByName = groupPackageInstancesByName(
  runtimePackageInstances,
);

for (const { packageName, files } of packagedRuntimePatches) {
  let workspacePackageJsonPath;
  try {
    workspacePackageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [desktopPackageRoot],
    });
  } catch {
    failPatch(
      `Workspace ${packageName} dependency cannot be resolved from ${desktopPackageRoot}. Run yarn install first.`,
    );
  }
  const packageInstances = runtimePackageInstancesByName.get(packageName) || [];
  if (!packageInstances.length) {
    failPatch(
      `Runtime ${packageName} dependency is missing under ${runtimeNodeModulesRoot}. Run electron-builder install-app-deps first.`,
    );
  }

  const workspacePackageRoot = path.dirname(workspacePackageJsonPath);
  const workspacePackage = readPackageMetadata(
    workspacePackageJsonPath,
    `Workspace ${packageName} package metadata`,
  );

  for (const packageInstance of packageInstances) {
    const runtimePackageRoot = packageInstance.packageRoot;
    const runtimePackageJsonPath = path.join(
      runtimePackageRoot,
      'package.json',
    );
    const runtimePackage = readPackageMetadata(
      runtimePackageJsonPath,
      `Runtime ${packageName} package metadata`,
    );

    if (runtimePackage.version !== workspacePackage.version) {
      failPatch(
        `${packageName} version mismatch at ${runtimePackageRoot}: runtime=${runtimePackage.version}, workspace=${workspacePackage.version}.`,
      );
    }

    for (const relativePath of files) {
      const sourcePath = path.join(workspacePackageRoot, relativePath);
      const destinationPath = path.join(runtimePackageRoot, relativePath);
      if (!fs.existsSync(sourcePath)) {
        failPatch(`Workspace ${packageName} file is missing: ${sourcePath}.`);
      }
      if (!fs.existsSync(destinationPath)) {
        failPatch(
          `Runtime ${packageName} file is missing: ${destinationPath}.`,
        );
      }
      fs.copyFileSync(sourcePath, destinationPath);
    }

    process.stdout.write(
      `Applied ${packageName} ${runtimePackage.version} runtime patch (${path.relative(
        runtimeAppRoot,
        runtimePackageRoot,
      )}).\n`,
    );
  }
}
