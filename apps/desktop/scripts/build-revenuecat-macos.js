// oxlint-disable onekey/no-raw-error -- This standalone build script cannot import the application runtime.
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const moduleDirectory = path.resolve(
  __dirname,
  '../native-modules/revenuecat-macos',
);
const outputDirectory = path.join(moduleDirectory, 'build/universal');
const sdkVersion = '5.80.3';
const hybridVersion = '18.21.0';

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: moduleDirectory,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.error?.message || result.stderr || result.status}`,
    );
  }
  return result.stdout?.trim();
}

function sourceHash() {
  const hash = createHash('sha256');
  for (const file of [
    'Package.swift',
    'Package.resolved',
    'Sources/OneKeyRevenueCat/Bridge.swift',
    'src/revenuecat.c',
    'index.js',
  ]) {
    hash.update(fs.readFileSync(path.join(moduleDirectory, file)));
  }
  hash.update(fs.readFileSync(__filename));
  hash.update(require('../package.json').devDependencies.electron);
  return hash.digest('hex');
}

function verifyBuild() {
  if (process.platform !== 'darwin') {
    throw new Error('RevenueCat MAS builds require macOS and Xcode');
  }
  const metadata = JSON.parse(
    fs.readFileSync(path.join(outputDirectory, 'build-info.json'), 'utf8'),
  );
  if (metadata.sourceHash !== sourceHash()) {
    throw new Error(
      'RevenueCat native sources changed; run build:revenuecat:macos',
    );
  }
  for (const name of ['revenuecat.node', 'libOneKeyRevenueCat.dylib']) {
    run('xcrun', [
      'lipo',
      path.join(outputDirectory, name),
      '-verify_arch',
      'arm64',
      'x86_64',
    ]);
  }
}

function build() {
  if (process.platform !== 'darwin') {
    throw new Error('RevenueCat MAS builds require macOS and Xcode');
  }
  const podLock = fs.readFileSync(
    path.resolve(moduleDirectory, '../../../mobile/ios/Podfile.lock'),
    'utf8',
  );
  if (
    !podLock.includes(`RevenueCat (${sdkVersion})`) ||
    !podLock.includes(`PurchasesHybridCommon (${hybridVersion})`)
  ) {
    throw new Error(
      'Align the macOS RevenueCat SDK versions with iOS before building',
    );
  }

  const swiftArguments = [
    'build',
    '--disable-sandbox',
    // A shared scratch directory needs a fresh build graph when switching architectures.
    '--disable-build-manifest-caching',
    '--cache-path',
    '.build/cache',
    '--force-resolved-versions',
    '--configuration',
    'release',
    '--product',
    'OneKeyRevenueCat',
  ];
  const libraries = [];
  let resourceDirectory;
  for (const architecture of ['arm64', 'x86_64']) {
    const args = [...swiftArguments, '--arch', architecture];
    run('swift', args);
    const binDirectory = run('swift', [...args, '--show-bin-path'], true);
    libraries.push(path.join(binDirectory, 'libOneKeyRevenueCat.dylib'));
    resourceDirectory ||= binDirectory;
  }

  const stagingDirectory = path.join(moduleDirectory, 'build/staging');
  fs.rmSync(stagingDirectory, { recursive: true, force: true });
  fs.mkdirSync(stagingDirectory, { recursive: true });
  const dynamicLibrary = path.join(
    stagingDirectory,
    'libOneKeyRevenueCat.dylib',
  );
  run('xcrun', ['lipo', '-create', ...libraries, '-output', dynamicLibrary]);
  run('xcrun', [
    'install_name_tool',
    '-id',
    '@rpath/libOneKeyRevenueCat.dylib',
    dynamicLibrary,
  ]);

  const headerDirectory = path.join(moduleDirectory, '.build/node-headers');
  const electronVersion = require('../package.json').devDependencies.electron;
  run(process.execPath, [
    require.resolve('node-gyp/bin/node-gyp.js'),
    'install',
    '--ensure',
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
    // cspell:ignore devdir
    `--devdir=${headerDirectory}`,
  ]);
  run('xcrun', [
    'clang',
    '-arch',
    'arm64',
    '-arch',
    'x86_64',
    '-mmacosx-version-min=11.0',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-DNAPI_VERSION=8',
    '-bundle',
    '-undefined',
    'dynamic_lookup',
    '-I',
    path.join(headerDirectory, electronVersion, 'include/node'),
    'src/revenuecat.c',
    '-L',
    stagingDirectory,
    '-lOneKeyRevenueCat',
    '-Wl,-rpath,@loader_path',
    '-o',
    path.join(stagingDirectory, 'revenuecat.node'),
  ]);
  // Combining architectures and updating library paths invalidate the linker's ad hoc signature.
  // electron-builder replaces these development signatures with the MAS identity.
  for (const binary of ['libOneKeyRevenueCat.dylib', 'revenuecat.node']) {
    run('codesign', [
      '--force',
      '--sign',
      '-',
      path.join(stagingDirectory, binary),
    ]);
  }

  // Keep the official SDK privacy manifests in the app's signed Resources directory.
  const resources = path.join(stagingDirectory, 'Resources');
  fs.mkdirSync(resources, { recursive: true });
  for (const file of fs.readdirSync(resourceDirectory)) {
    if (file.endsWith('.bundle')) {
      fs.cpSync(
        path.join(resourceDirectory, file),
        path.join(resources, file),
        {
          recursive: true,
        },
      );
    }
  }
  // Hybrid Common's SPM manifest omits its privacy resource; preserve the official manifest.
  const hybridBundle = path.join(
    resources,
    'PurchasesHybridCommon.bundle/Contents',
  );
  fs.mkdirSync(path.join(hybridBundle, 'Resources'), { recursive: true });
  fs.copyFileSync(
    path.join(
      moduleDirectory,
      '.build/checkouts/purchases-hybrid-common/ios/PurchasesHybridCommon/PurchasesHybridCommon/PrivacyInfo.xcprivacy',
    ),
    path.join(hybridBundle, 'Resources/PrivacyInfo.xcprivacy'),
  );
  fs.writeFileSync(
    path.join(hybridBundle, 'Info.plist'),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
      '<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.revenuecat.PurchasesHybridCommon</string><key>CFBundlePackageType</key><string>BNDL</string></dict></plist>\n',
  );
  for (const checkout of ['purchases-ios-spm', 'purchases-hybrid-common']) {
    fs.copyFileSync(
      path.join(moduleDirectory, '.build/checkouts', checkout, 'LICENSE'),
      path.join(stagingDirectory, `${checkout}-LICENSE.txt`),
    );
  }
  fs.copyFileSync(
    path.join(moduleDirectory, 'index.js'),
    path.join(stagingDirectory, 'index.js'),
  );
  fs.writeFileSync(
    path.join(stagingDirectory, 'build-info.json'),
    JSON.stringify(
      { sdkVersion, hybridVersion, sourceHash: sourceHash() },
      null,
      2,
    ),
  );
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.renameSync(stagingDirectory, outputDirectory);
  verifyBuild();
  console.log(
    'RevenueCat macOS bridge built and verified for arm64 and x86_64',
  );
}

if (require.main === module) {
  if (process.argv.includes('--verify')) {
    verifyBuild();
  } else {
    build();
  }
}

module.exports = { verifyBuild };
