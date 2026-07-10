const fs = require('fs');
const path = require('path');

function failVerification(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const runtimePackageRoot = path.join(
  __dirname,
  '../app/node_modules/electron-updater',
);
const workspacePackageRoot = path.join(
  __dirname,
  '../../../node_modules/electron-updater',
);
const runtimePackageJsonPath = path.join(runtimePackageRoot, 'package.json');

if (!fs.existsSync(runtimePackageJsonPath)) {
  failVerification(
    `Runtime dependency is missing: ${runtimePackageJsonPath}. Run yarn install-app-deps first.`,
  );
}

const runtimePackage = JSON.parse(
  fs.readFileSync(runtimePackageJsonPath, 'utf8'),
);
const expectedVersion = '6.8.9';

if (runtimePackage.version !== expectedVersion) {
  failVerification(
    `Unexpected electron-updater runtime version: ${runtimePackage.version}; expected ${expectedVersion}.`,
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
const patchedFiles = [
  'out/AppUpdater.d.ts',
  'out/AppUpdater.js',
  'out/BaseUpdater.d.ts',
  'out/BaseUpdater.js',
  'out/DownloadedUpdateHelper.d.ts',
  'out/DownloadedUpdateHelper.js',
];

for (const [relativePath, marker] of expectedRuntimePatchMarkers) {
  const filePath = path.join(runtimePackageRoot, relativePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  if (!fileContent.includes(marker)) {
    failVerification(
      `electron-updater runtime patch is missing marker "${marker}" in ${filePath}.`,
    );
  }
}

for (const relativePath of patchedFiles) {
  const runtimeFilePath = path.join(runtimePackageRoot, relativePath);
  const workspaceFilePath = path.join(workspacePackageRoot, relativePath);
  const runtimeFileContent = fs.readFileSync(runtimeFilePath, 'utf8');
  const workspaceFileContent = fs.readFileSync(workspaceFilePath, 'utf8');
  if (runtimeFileContent !== workspaceFileContent) {
    failVerification(
      `Packaged runtime patch differs from the workspace patch: ${relativePath}.`,
    );
  }
}

process.stdout.write(
  `Verified electron-updater ${expectedVersion} runtime patch.\n`,
);
