const fs = require('fs');
const path = require('path');

const {
  electronUpdaterRuntimePatchFiles,
} = require('./electron-updater-runtime-patch-files');

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
const runtimePackageRoot = path.join(
  __dirname,
  '../app/node_modules/electron-updater',
);
const runtimePackageJsonPath = path.join(runtimePackageRoot, 'package.json');
let workspacePackageJsonPath;
try {
  workspacePackageJsonPath = require.resolve('electron-updater/package.json', {
    paths: [desktopPackageRoot],
  });
} catch {
  failVerification(
    `Workspace electron-updater dependency cannot be resolved from ${desktopPackageRoot}. Run yarn install first.`,
  );
}
const workspacePackageRoot = path.dirname(workspacePackageJsonPath);

const runtimePackage = readPackageMetadata(
  runtimePackageJsonPath,
  'Runtime electron-updater package metadata',
);
const workspacePackage = readPackageMetadata(
  workspacePackageJsonPath,
  'Workspace electron-updater package metadata',
);

if (runtimePackage.version !== workspacePackage.version) {
  failVerification(
    `electron-updater version mismatch: runtime=${runtimePackage.version}, workspace=${workspacePackage.version}.`,
  );
}

const expectedRuntimePatchMarkers = [
  ['out/AppUpdater.js', 'this.emit("update-download-fileInfo", fileInfo);'],
  ['out/BaseUpdater.js', 'isExistInstallerPath()'],
  ['out/BaseUpdater.js', 'async updateInstallerPath(installerPath)'],
  ['out/DownloadedUpdateHelper.js', 'updateFile(file)'],
  [
    'out/DownloadedUpdateHelper.js',
    'updateDownloadedFileInfo(downloadedFileInfo)',
  ],
];
for (const [relativePath, marker] of expectedRuntimePatchMarkers) {
  const filePath = path.join(runtimePackageRoot, relativePath);
  const fileContent = readRequiredFile(
    filePath,
    `Runtime electron-updater file ${relativePath}`,
  );
  if (!fileContent.includes(marker)) {
    failVerification(
      `electron-updater runtime patch is missing marker "${marker}" in ${filePath}.`,
    );
  }
}

for (const relativePath of electronUpdaterRuntimePatchFiles) {
  const runtimeFilePath = path.join(runtimePackageRoot, relativePath);
  const workspaceFilePath = path.join(workspacePackageRoot, relativePath);
  const runtimeFileContent = readRequiredFile(
    runtimeFilePath,
    `Runtime electron-updater file ${relativePath}`,
  );
  const workspaceFileContent = readRequiredFile(
    workspaceFilePath,
    `Workspace electron-updater file ${relativePath}`,
  );
  if (runtimeFileContent !== workspaceFileContent) {
    failVerification(
      `Packaged runtime patch differs from the workspace patch: ${relativePath}.`,
    );
  }
}

process.stdout.write(
  `Verified electron-updater ${runtimePackage.version} runtime patch.\n`,
);
