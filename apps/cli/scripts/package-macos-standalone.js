#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cliRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(cliRoot, '../..');
const packageJsonPath = path.join(cliRoot, 'package.json');
const cliPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

class PackageMacOSStandaloneError extends Error {}

const supportedArchitectures = new Set(['arm64', 'x64']);
const arch = process.env.CLI_MACOS_ARCH || process.arch;
const bundleId = process.env.CLI_MACOS_BUNDLE_ID || 'so.onekey.cli';
const entitlementsPath =
  process.env.CLI_MACOS_ENTITLEMENTS ||
  path.join(cliRoot, 'entitlements.macos-standalone.plist');
const signIdentity = process.env.CLI_MACOS_SIGN_IDENTITY || '-';
const signingKeychain = process.env.CLI_MACOS_SIGNING_KEYCHAIN || '';
const timestamp =
  signIdentity === '-' || process.env.CLI_MACOS_TIMESTAMP === 'false'
    ? 'none'
    : undefined;
const hardenedRuntime = process.env.CLI_MACOS_HARDENED_RUNTIME === 'true';
const seaSentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const keyringSeaAssetKey = 'onekey-cli/keyring-native.node';
const nodeOptionsEnvKey = Buffer.from('NODE_OPTIONS');
const disabledNodeOptionsEnvKey = Buffer.from('NO=E_OPTIONS');

function run(command, args, options = {}) {
  console.log(`$ ${[command, ...args].join(' ')}`);
  execFileSync(command, args, {
    cwd: options.cwd || cliRoot,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: 'inherit',
  });
}

function capture(command, args, options = {}) {
  console.log(`$ ${[command, ...args].join(' ')}`);
  return execFileSync(command, args, {
    cwd: options.cwd || cliRoot,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function ensureDarwinHost() {
  if (process.platform !== 'darwin') {
    throw new PackageMacOSStandaloneError(
      'macOS standalone packaging must run on a macOS host.',
    );
  }

  if (!supportedArchitectures.has(arch)) {
    throw new PackageMacOSStandaloneError(
      `Unsupported macOS CLI architecture: ${arch}`,
    );
  }

  if (process.arch !== arch) {
    throw new PackageMacOSStandaloneError(
      `Cannot build darwin-${arch} from a darwin-${process.arch} Node runtime.`,
    );
  }
}

function stripShebang(source) {
  return source.startsWith('#!') ? source.replace(/^#!.*\n/, '') : source;
}

function defaultStandalonePackageName(sourceName) {
  if (sourceName.startsWith('@')) {
    const [scope, name] = sourceName.split('/');
    return `${scope}/${name}-darwin-${arch}`;
  }
  return `${sourceName}-darwin-${arch}`;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function getNativePackageName(packageName) {
  if (process.platform === 'darwin') {
    return `${packageName}-darwin-${arch}`;
  }

  throw new PackageMacOSStandaloneError(
    `No native keyring package mapping for ${process.platform}-${arch}.`,
  );
}

function resolveNativeKeyringBindingPath() {
  const nativePackageName = getNativePackageName('@napi-rs/keyring');
  const nativePackageMain = require.resolve(nativePackageName, {
    paths: [repoRoot],
  });

  if (!nativePackageMain.endsWith('.node')) {
    throw new PackageMacOSStandaloneError(
      `${nativePackageName} resolved to a non-native entry: ${nativePackageMain}`,
    );
  }

  return nativePackageMain;
}

function prepareNativeKeyringBinding({ buildDir }) {
  const nativeBindingPath = resolveNativeKeyringBindingPath();
  const signedNativeBindingPath = path.join(buildDir, 'keyring-native.node');

  fs.copyFileSync(nativeBindingPath, signedNativeBindingPath);
  fs.chmodSync(signedNativeBindingPath, 0o755);
  removeSignature(signedNativeBindingPath);
  signFile(signedNativeBindingPath, {
    identifier: `${bundleId}.keyring-native`,
  });
  run('codesign', ['--verify', '--verbose=2', signedNativeBindingPath], {
    cwd: repoRoot,
  });

  return signedNativeBindingPath;
}

function supportsBuildSea() {
  try {
    const help = execFileSync(process.execPath, ['--help'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return help.includes('--build-sea=');
  } catch {
    return false;
  }
}

function ensureNodeSupportsSeaInjection() {
  const nodeBinary = fs.readFileSync(process.execPath);
  if (!nodeBinary.includes(Buffer.from(seaSentinel))) {
    throw new PackageMacOSStandaloneError(
      [
        `The current Node binary does not contain the SEA fuse: ${process.execPath}`,
        'Use an official Node.js binary with single executable application support.',
        'GitHub Actions `actions/setup-node` Node 24.x provides a compatible binary.',
      ].join('\n'),
    );
  }
}

function signFile(
  filePath,
  { identifier = bundleId, entitlements = false } = {},
) {
  const args = ['--force', '--sign', signIdentity, '--identifier', identifier];

  if (signingKeychain) {
    args.push('--keychain', signingKeychain);
  }
  if (timestamp) {
    args.push(`--timestamp=${timestamp}`);
  } else {
    args.push('--timestamp');
  }
  if (hardenedRuntime) {
    args.push('--options', 'runtime');
  }
  if (entitlements) {
    args.push('--entitlements', entitlementsPath);
  }

  args.push(filePath);
  run('codesign', args, { cwd: repoRoot });
}

function disableNodeOptionsEnv(filePath) {
  if (nodeOptionsEnvKey.length !== disabledNodeOptionsEnvKey.length) {
    throw new PackageMacOSStandaloneError(
      'NODE_OPTIONS patch key lengths must match.',
    );
  }

  const contents = fs.readFileSync(filePath);
  let replacements = 0;
  let offset = contents.indexOf(nodeOptionsEnvKey);
  while (offset !== -1) {
    disabledNodeOptionsEnvKey.copy(contents, offset);
    replacements += 1;
    offset = contents.indexOf(
      nodeOptionsEnvKey,
      offset + disabledNodeOptionsEnvKey.length,
    );
  }

  if (replacements === 0) {
    throw new PackageMacOSStandaloneError(
      `Could not find NODE_OPTIONS references in ${filePath}.`,
    );
  }

  fs.writeFileSync(filePath, contents);
  console.log(
    `Patched ${replacements} NODE_OPTIONS runtime reference(s) in ${filePath}.`,
  );
}

function removeSignature(filePath) {
  try {
    execFileSync('codesign', ['--remove-signature', filePath], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
  } catch {
    // Fresh Node binaries may not have a removable signature in local dev.
  }
}

function assertMachOArchitecture(filePath) {
  const expectedArchitecture = arch === 'arm64' ? 'arm64' : 'x86_64';
  const fileDescription = capture('file', [filePath], { cwd: repoRoot }).trim();
  console.log(fileDescription);

  if (!fileDescription.includes('Mach-O 64-bit executable')) {
    throw new PackageMacOSStandaloneError(
      `${filePath} is not a Mach-O 64-bit executable.`,
    );
  }

  if (!fileDescription.includes(expectedArchitecture)) {
    throw new PackageMacOSStandaloneError(
      `${filePath} does not match expected architecture ${expectedArchitecture}.`,
    );
  }
}

function assertExecutableMode(filePath) {
  if ((fs.statSync(filePath).mode & 0o111) === 0) {
    throw new PackageMacOSStandaloneError(
      `${filePath} is not marked as executable.`,
    );
  }
}

function assertNodeOptionsPatched(filePath) {
  if (fs.readFileSync(filePath).includes(nodeOptionsEnvKey)) {
    throw new PackageMacOSStandaloneError(
      `${filePath} still contains NODE_OPTIONS references.`,
    );
  }
}

function verifyStandaloneExecutable(filePath, label) {
  console.log('');
  console.log(`Verifying ${label}: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    throw new PackageMacOSStandaloneError(`Missing ${label}: ${filePath}`);
  }

  assertExecutableMode(filePath);
  assertMachOArchitecture(filePath);
  assertNodeOptionsPatched(filePath);
  run('codesign', ['--verify', '--verbose=2', filePath], { cwd: repoRoot });
  run(filePath, ['--version'], {
    cwd: cliRoot,
    env: {
      HOME: path.join(path.dirname(filePath), '.onekey-cli-home'),
    },
  });
}

function findFirstExecutable(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const found = findFirstExecutable(entryPath);
      if (found) {
        return found;
      }
    } else if (entry.isFile() && entry.name === 'onekey') {
      return entryPath;
    }
  }

  return '';
}

function getSingleTarballPath(tarballDir) {
  const tarballs = fs
    .readdirSync(tarballDir)
    .filter((fileName) => fileName.endsWith('.tgz'));

  if (tarballs.length !== 1) {
    throw new PackageMacOSStandaloneError(
      `Expected exactly one npm tarball in ${tarballDir}, found ${tarballs.length}.`,
    );
  }

  return path.join(tarballDir, tarballs[0]);
}

function verifyPackagedArtifacts({
  buildDir,
  executablePath,
  npmPackage,
  zipPath,
}) {
  const verifyDir = path.join(buildDir, 'artifact-verify');
  const zipExtractDir = path.join(verifyDir, 'zip');
  const tarballExtractDir = path.join(verifyDir, 'tarball');
  const tarballPath = getSingleTarballPath(npmPackage.tarballDir);

  fs.rmSync(verifyDir, { recursive: true, force: true });
  fs.mkdirSync(zipExtractDir, { recursive: true });
  fs.mkdirSync(tarballExtractDir, { recursive: true });

  verifyStandaloneExecutable(executablePath, 'raw standalone executable');

  run('ditto', ['-x', '-k', zipPath, zipExtractDir], { cwd: repoRoot });
  const zipExecutablePath = findFirstExecutable(zipExtractDir);
  if (!zipExecutablePath) {
    throw new PackageMacOSStandaloneError(
      `Distribution zip does not contain an onekey executable: ${zipPath}`,
    );
  }
  verifyStandaloneExecutable(zipExecutablePath, 'distribution zip executable');

  run('tar', ['-xzf', tarballPath, '-C', tarballExtractDir], { cwd: repoRoot });
  const tarballExecutablePath = path.join(
    tarballExtractDir,
    'package',
    'bin',
    'onekey',
  );
  verifyStandaloneExecutable(tarballExecutablePath, 'npm tarball executable');
}

function prepareSeaEntry(distCliPath, seaEntryPath) {
  const cliBundle = stripShebang(fs.readFileSync(distCliPath, 'utf8'));
  const bootstrap = [
    "const { realpathSync: __onekeyRealpathSync } = require('node:fs');",
    "const __onekeyModule = require('node:module');",
    "delete process.env['NODE' + '_OPTIONS'];",
    'delete process.env.NODE_PATH;',
    '__onekeyModule.globalPaths.length = 0;',
    'const __onekeyRuntimeRequirePath = (() => {',
    '  try { return __onekeyRealpathSync(process.execPath); } catch { return process.execPath; }',
    '})();',
    'require = __onekeyModule.createRequire(__onekeyRuntimeRequirePath);',
    'process.noDeprecation = true;',
    "process.env.ONEKEY_CLI_STANDALONE = '1';",
    '',
  ].join('\n');

  fs.writeFileSync(seaEntryPath, `${bootstrap}${cliBundle}`);
}

function buildStandaloneBinary({ buildDir, executablePath }) {
  const distCliPath = path.join(cliRoot, 'dist/cli.js');
  if (!fs.existsSync(distCliPath)) {
    throw new PackageMacOSStandaloneError(
      'Missing dist/cli.js. Run `yarn build` before packaging.',
    );
  }

  const seaEntryPath = path.join(buildDir, 'sea-entry.cjs');
  const seaConfigPath = path.join(buildDir, 'sea-config.json');
  const seaBlobPath = path.join(buildDir, 'onekey-sea.blob');
  const nativeKeyringBindingPath = prepareNativeKeyringBinding({ buildDir });

  ensureNodeSupportsSeaInjection();
  prepareSeaEntry(distCliPath, seaEntryPath);

  if (supportsBuildSea()) {
    writeJson(seaConfigPath, {
      main: seaEntryPath,
      executable: process.execPath,
      output: executablePath,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false,
      assets: {
        [keyringSeaAssetKey]: nativeKeyringBindingPath,
      },
    });

    run(process.execPath, [`--build-sea=${seaConfigPath}`], {
      cwd: cliRoot,
    });
    fs.chmodSync(executablePath, 0o755);
    disableNodeOptionsEnv(executablePath);
    signFile(executablePath, { entitlements: hardenedRuntime });
    run('codesign', ['--verify', '--verbose=2', executablePath], {
      cwd: repoRoot,
    });
    return;
  }

  writeJson(seaConfigPath, {
    main: seaEntryPath,
    output: seaBlobPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets: {
      [keyringSeaAssetKey]: nativeKeyringBindingPath,
    },
  });

  run(process.execPath, ['--experimental-sea-config', seaConfigPath], {
    cwd: cliRoot,
  });

  fs.copyFileSync(process.execPath, executablePath);
  fs.chmodSync(executablePath, 0o755);
  removeSignature(executablePath);

  run(
    process.execPath,
    [
      require.resolve('postject/dist/cli.js'),
      executablePath,
      'NODE_SEA_BLOB',
      seaBlobPath,
      '--sentinel-fuse',
      seaSentinel,
      '--macho-segment-name',
      'NODE_SEA',
    ],
    { cwd: cliRoot },
  );

  disableNodeOptionsEnv(executablePath);
  signFile(executablePath, { entitlements: hardenedRuntime });
  run('codesign', ['--verify', '--verbose=2', executablePath], {
    cwd: repoRoot,
  });
}

function buildNpmPackage({ buildDir, executablePath }) {
  const packageDir = path.join(buildDir, 'npm-package');
  const tarballDir = path.join(buildDir, 'npm-tarball');
  const packageName =
    process.env.CLI_STANDALONE_PACKAGE_NAME ||
    defaultStandalonePackageName(cliPackage.name);

  fs.rmSync(packageDir, { recursive: true, force: true });
  fs.rmSync(tarballDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(packageDir, 'bin'), { recursive: true });
  fs.mkdirSync(tarballDir, { recursive: true });

  fs.copyFileSync(executablePath, path.join(packageDir, 'bin/onekey'));
  fs.chmodSync(path.join(packageDir, 'bin/onekey'), 0o755);

  writeJson(path.join(packageDir, 'package.json'), {
    name: packageName,
    version: cliPackage.version,
    description: `${cliPackage.description} (macOS ${arch} standalone)`,
    bin: {
      onekey: './bin/onekey',
    },
    os: ['darwin'],
    cpu: [arch],
    engines: cliPackage.engines,
    dependencies: cliPackage.dependencies,
    license: cliPackage.license,
    repository: cliPackage.repository,
    publishConfig: {
      access: 'public',
    },
  });

  fs.writeFileSync(
    path.join(packageDir, 'README.md'),
    [
      `# ${packageName}`,
      '',
      `Signed macOS ${arch} standalone distribution for OneKey CLI.`,
      '',
      'The `onekey` executable is a command-line Mach-O binary. It is not a',
      'macOS `.app` bundle and does not require LaunchAgent or background',
      'service installation.',
      '',
      'The binary embeds the macOS `@napi-rs/keyring` native binding used for',
      'Keychain access, so Keychain operations do not require the user/system',
      '`node` executable.',
      '',
    ].join('\n'),
  );

  run('npm', ['pack', '--pack-destination', tarballDir], {
    cwd: packageDir,
    env: {
      npm_config_cache: path.join(buildDir, '.npm-cache'),
      npm_config_update_notifier: 'false',
    },
  });

  return {
    packageDir,
    packageName,
    tarballDir,
  };
}

function buildDistributionZip({ buildDir, executablePath }) {
  const zipPath = path.join(buildDir, `onekey-cli-darwin-${arch}.zip`);

  fs.rmSync(zipPath, { force: true });
  run(
    'ditto',
    ['-c', '-k', '--keepParent', path.basename(executablePath), zipPath],
    {
      cwd: path.dirname(executablePath),
    },
  );

  return zipPath;
}

function main() {
  ensureDarwinHost();

  const buildDir = path.join(
    cliRoot,
    'build',
    'macos-standalone',
    `darwin-${arch}`,
  );
  const executablePath = path.join(buildDir, 'onekey');

  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  buildStandaloneBinary({ buildDir, executablePath });
  const npmPackage = buildNpmPackage({ buildDir, executablePath });
  const zipPath = buildDistributionZip({ buildDir, executablePath });
  verifyPackagedArtifacts({ buildDir, executablePath, npmPackage, zipPath });

  console.log('');
  console.log(`Built: ${executablePath}`);
  console.log(`Distribution zip: ${zipPath}`);
  console.log(`NPM package: ${npmPackage.packageName}`);
  console.log(`Tarball dir: ${npmPackage.tarballDir}`);
}

main();
