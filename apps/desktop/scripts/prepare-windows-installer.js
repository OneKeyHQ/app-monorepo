const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (process.platform === 'win32') {
  const preparation = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'RemoteSigned',
      '-File',
      path.join(__dirname, 'prepare-windows-installer.ps1'),
    ],
    { stdio: 'inherit' },
  );
  if (preparation.error) console.error(preparation.error.message);
  process.exitCode = preparation.status ?? 1;
}
