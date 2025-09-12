const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');

const id = setInterval(checkPort, 1000);

function checkPort() {
  try {
    if (process.platform !== 'win32') {
      const status = execSync('lsof -i:3001', {});
      if (!status) return;
    }
  } catch (e) {
    return;
  }

  execSync('yarn run dev:main', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  clearInterval(id);
}
