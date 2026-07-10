const {
  electronUpdaterRuntimePatchFiles,
} = require('./electron-updater-runtime-patch-files');

const sentryBrowserRuntimePatchFiles = [
  'build/npm/cjs/integrations/breadcrumbs.js',
  'build/npm/esm/integrations/breadcrumbs.js',
];

const packagedRuntimePatches = [
  {
    packageName: 'electron-updater',
    files: electronUpdaterRuntimePatchFiles,
    markers: [
      ['out/AppUpdater.js', 'this.emit("update-download-fileInfo", fileInfo);'],
      ['out/BaseUpdater.js', 'isExistInstallerPath()'],
      ['out/BaseUpdater.js', 'async updateInstallerPath(installerPath)'],
      ['out/DownloadedUpdateHelper.js', 'updateFile(file)'],
      [
        'out/DownloadedUpdateHelper.js',
        'updateDownloadedFileInfo(downloadedFileInfo)',
      ],
    ],
  },
  {
    packageName: '@sentry/browser',
    files: sentryBrowserRuntimePatchFiles,
    markers: sentryBrowserRuntimePatchFiles.map((relativePath) => [
      relativePath,
      "data.request_id = request_headers['x-onekey-request-id'];",
    ]),
  },
];

module.exports = { packagedRuntimePatches };
