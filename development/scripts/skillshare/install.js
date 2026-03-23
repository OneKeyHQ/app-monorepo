const { execSync } = require('child_process');
const path = require('path');

const dir = path.join(__dirname);

if (process.platform === 'win32') {
  execSync(
    `powershell -ExecutionPolicy Bypass -File "${path.join(dir, 'install-skillshare.ps1')}"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`sh "${path.join(dir, 'install-skillshare.sh')}"`, {
    stdio: 'inherit',
  });
}
