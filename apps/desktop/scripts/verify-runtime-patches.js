const fs = require('fs');
const path = require('path');

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

for (const { packageName, files, markers } of packagedRuntimePatches) {
  let workspacePackageJsonPath;
  let runtimePackageJsonPath;
  try {
    workspacePackageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [desktopPackageRoot],
    });
  } catch {
    failVerification(
      `Workspace ${packageName} dependency cannot be resolved from ${desktopPackageRoot}. Run yarn install first.`,
    );
  }
  try {
    runtimePackageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [runtimeAppRoot],
    });
  } catch {
    failVerification(
      `Runtime ${packageName} dependency cannot be resolved from ${runtimeAppRoot}. Run electron-builder install-app-deps first.`,
    );
  }

  const workspacePackageRoot = path.dirname(workspacePackageJsonPath);
  const runtimePackageRoot = path.dirname(runtimePackageJsonPath);
  const runtimePackage = readPackageMetadata(
    runtimePackageJsonPath,
    `Runtime ${packageName} package metadata`,
  );
  const workspacePackage = readPackageMetadata(
    workspacePackageJsonPath,
    `Workspace ${packageName} package metadata`,
  );

  if (runtimePackage.version !== workspacePackage.version) {
    failVerification(
      `${packageName} version mismatch: runtime=${runtimePackage.version}, workspace=${workspacePackage.version}.`,
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
        `Packaged ${packageName} runtime patch differs from the workspace patch: ${relativePath}.`,
      );
    }
  }

  process.stdout.write(
    `Verified ${packageName} ${runtimePackage.version} runtime patch.\n`,
  );
}
