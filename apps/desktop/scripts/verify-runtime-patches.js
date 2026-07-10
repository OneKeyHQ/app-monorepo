const fs = require('fs');
const path = require('path');

const {
  findInstalledPackageInstances,
  groupPackageInstancesByName,
} = require('./packaged-runtime-patch-utils');
const { packagedRuntimePatches } = require('./packaged-runtime-patches');

function failVerification(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readRequiredFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    failVerification(`${description} is missing: ${filePath}.`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readPackageMetadata(packageJsonPath, description) {
  const packageJson = readRequiredFile(packageJsonPath, description);
  try {
    return JSON.parse(packageJson);
  } catch (error) {
    failVerification(
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
  failVerification(
    `Cannot inspect runtime dependencies under ${runtimeNodeModulesRoot}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
const runtimePackageInstancesByName = groupPackageInstancesByName(
  runtimePackageInstances,
);

for (const { packageName, files, markers } of packagedRuntimePatches) {
  let workspacePackageJsonPath;
  try {
    workspacePackageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [desktopPackageRoot],
    });
  } catch {
    failVerification(
      `Workspace ${packageName} dependency cannot be resolved from ${desktopPackageRoot}. Run yarn install first.`,
    );
  }
  const packageInstances = runtimePackageInstancesByName.get(packageName) || [];
  if (!packageInstances.length) {
    failVerification(
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
      failVerification(
        `${packageName} version mismatch at ${runtimePackageRoot}: runtime=${runtimePackage.version}, workspace=${workspacePackage.version}.`,
      );
    }

    for (const [relativePath, marker] of markers) {
      const filePath = path.join(runtimePackageRoot, relativePath);
      const fileContent = readRequiredFile(
        filePath,
        `Runtime ${packageName} file ${relativePath}`,
      );
      if (!fileContent.includes(marker)) {
        failVerification(
          `${packageName} runtime patch is missing marker "${marker}" in ${filePath}.`,
        );
      }
    }

    for (const relativePath of files) {
      const runtimeFilePath = path.join(runtimePackageRoot, relativePath);
      const workspaceFilePath = path.join(workspacePackageRoot, relativePath);
      const runtimeFileContent = readRequiredFile(
        runtimeFilePath,
        `Runtime ${packageName} file ${relativePath}`,
      );
      const workspaceFileContent = readRequiredFile(
        workspaceFilePath,
        `Workspace ${packageName} file ${relativePath}`,
      );
      if (runtimeFileContent !== workspaceFileContent) {
        failVerification(
          `Packaged ${packageName} runtime patch differs from the workspace patch at ${runtimePackageRoot}: ${relativePath}.`,
        );
      }
    }

    process.stdout.write(
      `Verified ${packageName} ${runtimePackage.version} runtime patch (${path.relative(
        runtimeAppRoot,
        runtimePackageRoot,
      )}).\n`,
    );
  }
}
