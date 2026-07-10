const fs = require('fs');
const path = require('path');

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

for (const { packageName, files } of packagedRuntimePatches) {
  let workspacePackageJsonPath;
  let runtimePackageJsonPath;
  try {
    workspacePackageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [desktopPackageRoot],
    });
  } catch {
    failPatch(
      `Workspace ${packageName} dependency cannot be resolved from ${desktopPackageRoot}. Run yarn install first.`,
    );
  }
  try {
    runtimePackageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [runtimeAppRoot],
    });
  } catch {
    failPatch(
      `Runtime ${packageName} dependency cannot be resolved from ${runtimeAppRoot}. Run electron-builder install-app-deps first.`,
    );
  }

  const workspacePackageRoot = path.dirname(workspacePackageJsonPath);
  const runtimePackageRoot = path.dirname(runtimePackageJsonPath);
  const workspacePackage = readPackageMetadata(
    workspacePackageJsonPath,
    `Workspace ${packageName} package metadata`,
  );
  const runtimePackage = readPackageMetadata(
    runtimePackageJsonPath,
    `Runtime ${packageName} package metadata`,
  );

  if (runtimePackage.version !== workspacePackage.version) {
    failPatch(
      `${packageName} version mismatch: runtime=${runtimePackage.version}, workspace=${workspacePackage.version}.`,
    );
  }

  for (const relativePath of files) {
    const sourcePath = path.join(workspacePackageRoot, relativePath);
    const destinationPath = path.join(runtimePackageRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      failPatch(`Workspace ${packageName} file is missing: ${sourcePath}.`);
    }
    if (!fs.existsSync(destinationPath)) {
      failPatch(`Runtime ${packageName} file is missing: ${destinationPath}.`);
    }
    fs.copyFileSync(sourcePath, destinationPath);
  }

  process.stdout.write(
    `Applied ${packageName} ${runtimePackage.version} runtime patch.\n`,
  );
}
