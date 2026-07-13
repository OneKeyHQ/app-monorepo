const fs = require('fs');
const path = require('path');

const {
  electronUpdaterRuntimePatchFiles,
} = require('./electron-updater-runtime-patch-files');

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
const runtimePackageRoot = path.join(
  desktopPackageRoot,
  'app/node_modules/electron-updater',
);
const runtimePackageJsonPath = path.join(runtimePackageRoot, 'package.json');
let workspacePackageJsonPath;
try {
  workspacePackageJsonPath = require.resolve('electron-updater/package.json', {
    paths: [desktopPackageRoot],
  });
} catch {
  failPatch(
    `Workspace electron-updater dependency cannot be resolved from ${desktopPackageRoot}. Run yarn install first.`,
  );
}
const workspacePackageRoot = path.dirname(workspacePackageJsonPath);
const workspacePackage = readPackageMetadata(
  workspacePackageJsonPath,
  'Workspace electron-updater package metadata',
);
const runtimePackage = readPackageMetadata(
  runtimePackageJsonPath,
  'Runtime electron-updater package metadata',
);

if (runtimePackage.version !== workspacePackage.version) {
  failPatch(
    `electron-updater version mismatch: runtime=${runtimePackage.version}, workspace=${workspacePackage.version}.`,
  );
}

for (const relativePath of electronUpdaterRuntimePatchFiles) {
  const sourcePath = path.join(workspacePackageRoot, relativePath);
  const destinationPath = path.join(runtimePackageRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    failPatch(`Workspace electron-updater file is missing: ${sourcePath}.`);
  }
  if (!fs.existsSync(destinationPath)) {
    failPatch(`Runtime electron-updater file is missing: ${destinationPath}.`);
  }
  fs.copyFileSync(sourcePath, destinationPath);
}

process.stdout.write(
  `Applied electron-updater ${runtimePackage.version} runtime patch.\n`,
);
