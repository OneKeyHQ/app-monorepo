// oxlint-disable onekey/no-raw-error -- This standalone build script cannot import the application runtime.
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const plist = require('@expo/plist').default;

const moduleDirectory = path.resolve(
  __dirname,
  '../native-modules/revenuecat-macos',
);
const outputDirectory = path.join(moduleDirectory, 'build/universal');
const sdkVersion = '5.80.3';
const hybridVersion = '18.21.0';
const resourceBundles = [
  {
    name: 'RevenueCat_RevenueCat',
    identifier: 'com.revenuecat.RevenueCat.resources',
    version: sdkVersion,
    infoPath: 'RevenueCat_RevenueCat.bundle/Info.plist',
    privacyPath: 'RevenueCat_RevenueCat.bundle/PrivacyInfo.xcprivacy',
  },
  {
    name: 'PurchasesHybridCommon',
    identifier: 'com.revenuecat.PurchasesHybridCommon',
    version: hybridVersion,
    infoPath: 'PurchasesHybridCommon.bundle/Contents/Info.plist',
    privacyPath:
      'PurchasesHybridCommon.bundle/Contents/Resources/PrivacyInfo.xcprivacy',
  },
];

function writeResourceBundleMetadata(resources) {
  for (const bundle of resourceBundles) {
    const infoPath = path.join(resources, bundle.infoPath);
    const existing = fs.existsSync(infoPath)
      ? plist.parse(fs.readFileSync(infoPath, 'utf8'))
      : {};
    // SwiftPM can emit only a development region, which App Store validation rejects.
    fs.writeFileSync(
      infoPath,
      plist.build({
        ...existing,
        CFBundleDevelopmentRegion: existing.CFBundleDevelopmentRegion || 'en',
        CFBundleIdentifier: bundle.identifier,
        CFBundleInfoDictionaryVersion: '6.0',
        CFBundleName: bundle.name,
        CFBundlePackageType: 'BNDL',
        CFBundleShortVersionString: bundle.version,
        CFBundleVersion: bundle.version,
      }),
    );
  }
}

function verifyResourceBundles(resources) {
  for (const bundle of resourceBundles) {
    const info = plist.parse(
      fs.readFileSync(path.join(resources, bundle.infoPath), 'utf8'),
    );
    if (
      typeof info.CFBundleIdentifier !== 'string' ||
      !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(info.CFBundleIdentifier) ||
      info.CFBundleIdentifier !== bundle.identifier ||
      info.CFBundleInfoDictionaryVersion !== '6.0' ||
      info.CFBundleName !== bundle.name ||
      info.CFBundlePackageType !== 'BNDL' ||
      info.CFBundleShortVersionString !== bundle.version ||
      info.CFBundleVersion !== bundle.version
    ) {
      throw new Error(
        `Invalid App Store resource bundle metadata: ${bundle.infoPath}`,
      );
    }
    plist.parse(
      fs.readFileSync(path.join(resources, bundle.privacyPath), 'utf8'),
    );
  }
}

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
  verifyResourceBundles(path.join(outputDirectory, 'Resources'));
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
  writeResourceBundleMetadata(resources);
  verifyResourceBundles(resources);
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

module.exports = {
  verifyBuild,
  verifyResourceBundles,
  writeResourceBundleMetadata,
};
