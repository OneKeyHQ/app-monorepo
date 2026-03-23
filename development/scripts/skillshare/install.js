// oxlint-disable @cspell/spellchecker
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);

/**
 * Ensure the default skillshare install dir is on PATH for this process.
 *
 * - Windows: User PATH is updated in the registry by install.ps1, but this Node process
 *   does not see it until a new shell — prepend %LOCALAPPDATA%\Programs\skillshare.
 * - macOS / Linux: install.sh puts the binary in /usr/local/bin. That dir is usually
 *   already on PATH; if not (minimal CI, custom env), prepend it when the binary exists.
 */
function getEnvForSkillshareCli() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
      return process.env;
    }
    const installDir = path.join(localAppData, 'Programs', 'skillshare');
    const exe = path.join(installDir, 'skillshare.exe');
    if (!fs.existsSync(exe)) {
      return process.env;
    }
    const pathKey = typeof process.env.Path === 'string' ? 'Path' : 'PATH';
    const currentPath = process.env[pathKey] || '';
    if (currentPath.toLowerCase().includes(installDir.toLowerCase())) {
      return process.env;
    }
    return {
      ...process.env,
      [pathKey]: `${installDir}${path.delimiter}${currentPath}`,
    };
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    const installDir = '/usr/local/bin';
    const bin = path.join(installDir, 'skillshare');
    if (!fs.existsSync(bin)) {
      return process.env;
    }
    const currentPath = process.env.PATH || '';
    const segments = currentPath.split(path.delimiter);
    if (segments.includes(installDir)) {
      return process.env;
    }
    return {
      ...process.env,
      PATH: `${installDir}${path.delimiter}${currentPath}`,
    };
  }

  return process.env;
}

/**
 * Returns true if the skillshare CLI is already usable (on PATH or default install dir).
 * When true, skip install.ps1 / install.sh so we do not download or replace the binary.
 */
function isSkillshareInstalled() {
  try {
    execSync('skillshare version', {
      stdio: 'pipe',
      env: getEnvForSkillshareCli(),
    });
    return true;
  } catch (_err) {
    return false;
  }
}

if (!isSkillshareInstalled()) {
  if (process.platform === 'win32') {
    execSync(
      `powershell -ExecutionPolicy Bypass -File "${path.join(dir, 'install.ps1')}"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`sh "${path.join(dir, 'install.sh')}"`, {
      stdio: 'inherit',
    });
  }
}

execSync('skillshare install -p && skillshare sync -p', {
  stdio: 'inherit',
  env: getEnvForSkillshareCli(),
});

const repoRoot = path.join(__dirname, '../../..');
const skillshareGitignores = [
  path.join(repoRoot, '.skillshare', '.gitignore'),
  path.join(repoRoot, '.skillshare', 'skills', '.gitignore'),
];
skillshareGitignores.forEach((gitignorePath) => {
  fs.rmSync(gitignorePath, { force: true });
});
