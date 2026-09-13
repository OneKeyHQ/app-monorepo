// cspell:ignore AppArmor apparmor lavamoat tunables userns

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { LavaMoatError } = require('./error.cjs');

function verifyExecutable(executable, installationRoot, basename) {
  if (!path.isAbsolute(executable) || !path.isAbsolute(installationRoot)) {
    throw new LavaMoatError(
      'Browser executable and installation root must be absolute.',
    );
  }
  const resolved = fs.realpathSync(executable);
  const relative = path.relative(fs.realpathSync(installationRoot), resolved);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    path.basename(resolved) !== basename ||
    !/^\/[a-zA-Z0-9/_.-]+$/.test(resolved)
  ) {
    throw new LavaMoatError(
      'Browser executable must have an exact safe path inside its installation.',
    );
  }
  const descriptor = fs.openSync(
    resolved,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
  );
  try {
    const stat = fs.fstatSync(descriptor);
    const magic = Buffer.alloc(4);
    if (
      !stat.isFile() ||
      !(stat.mode & 0o111) ||
      fs.readSync(descriptor, magic, 0, magic.length, 0) !== magic.length ||
      !magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
    ) {
      throw new LavaMoatError(
        'Browser executable must be an executable ELF file.',
      );
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return resolved;
}

function prepareProfiles({
  output,
  chromiumExecutable,
  chromiumRoot,
  electronExecutable,
  electronRoot,
}) {
  const executables = {
    chromium: verifyExecutable(chromiumExecutable, chromiumRoot, 'chrome'),
    electron: verifyExecutable(electronExecutable, electronRoot, 'electron'),
  };
  // These exceptions let Chromium create its namespace sandbox on Ubuntu 24.04.
  // They do not provide application confinement or disable Chromium sandboxing.
  // https://github.com/chromium/chromium/blob/main/docs/security/apparmor-userns-restrictions.md
  fs.mkdirSync(output, { mode: 0o700 });
  for (const [name, executable] of Object.entries(executables)) {
    const profile = `onekey-lavamoat-ci-${name}`;
    fs.writeFileSync(
      path.join(output, profile),
      `abi <abi/4.0>,\ninclude <tunables/global>\n\nprofile ${profile} "${executable}" flags=(unconfined) {\n  userns,\n}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  }
  return executables;
}

if (require.main === module) {
  try {
    if (
      process.platform !== 'linux' ||
      process.argv.length !== 3 ||
      !path.isAbsolute(process.argv[2])
    ) {
      throw new LavaMoatError(
        'Usage on Linux: node prepare-linux-browser-sandbox.cjs <new-absolute-output-directory>',
      );
    }
    const { chromium } = require('playwright-core');
    const executables = prepareProfiles({
      output: process.argv[2],
      chromiumExecutable: chromium.executablePath(),
      chromiumRoot:
        process.env.PLAYWRIGHT_BROWSERS_PATH ||
        path.join(os.homedir(), '.cache/ms-playwright'),
      electronExecutable: require('electron'),
      electronRoot: path.dirname(require.resolve('electron/package.json')),
    });
    console.log(JSON.stringify(executables));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepareProfiles };
