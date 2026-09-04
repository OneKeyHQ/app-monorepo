/* eslint-disable onekey/no-raw-error */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const devVendorConfig = require('../dev-vendor.config');

const {
  REPO_ROOT,
  compareModuleKeys,
  getModuleIdDomain,
  loadRegistry,
} = require('./moduleIdRegistry');

const MANIFEST_NAME = 'manifest.json';
const SUPPORTED_PLATFORMS = new Set(['android', 'ios']);
const SUPPORTED_RUNTIME_TARGETS = new Set(['main', 'background']);
const DEV_SESSION_ID_PATTERN =
  /^wk-[0-9a-f]{12}-dev-[0-9a-f]{12}-[0-9a-f]{16}$/u;
const NATIVE_CONTRACT_SOURCE_EXTENSIONS = {
  android: new Set(['.c', '.cc', '.cpp', '.h', '.hpp', '.java', '.kt']),
  ios: new Set(['.c', '.cc', '.cpp', '.h', '.hpp', '.m', '.mm', '.swift']),
};
const SHELL_INPUT_BINARY_EXTENSIONS = new Set([
  '.aar',
  '.bin',
  '.dat',
  '.gif',
  '.gz',
  '.ico',
  '.icns',
  '.jar',
  '.jpeg',
  '.jpg',
  '.keystore',
  '.pdf',
  '.png',
  '.so',
  '.ttf',
  '.woff',
  '.woff2',
]);
const runtimeCache = new Map();

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isDevVendorEnabled(env = process.env) {
  return env.ONEKEY_DEV_VENDOR === 'true';
}

function listDirectoryFiles(repoRoot, relativeDirectory) {
  const absoluteDirectory = path.resolve(repoRoot, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) {
    return [];
  }
  const pending = [absoluteDirectory];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(
          path.relative(repoRoot, absolutePath).split(path.sep).join('/'),
        );
      }
    }
  }
  return files.toSorted();
}

function getFingerprintInputPaths(repoRoot = REPO_ROOT) {
  return [
    ...devVendorConfig.fingerprintFiles,
    ...devVendorConfig.fingerprintOptionalFiles.filter((relativePath) =>
      fs.existsSync(path.resolve(repoRoot, relativePath)),
    ),
    ...devVendorConfig.fingerprintDirectories.flatMap((relativeDirectory) =>
      listDirectoryFiles(repoRoot, relativeDirectory),
    ),
  ].toSorted();
}

function listShellInputRepoFiles(repoRoot, inputScopes) {
  const result = spawnSync(
    'git',
    [
      '-C',
      repoRoot,
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...inputScopes,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.status !== 0 || result.error) {
    throw new Error(
      `[devVendor] Unable to list shell inputs: ${result.stderr || result.error?.message || 'unknown error'}`,
    );
  }
  return [...new Set(result.stdout.split('\0').filter(Boolean))].toSorted();
}

function getNativePatchInputPaths(
  platform,
  repoRoot = REPO_ROOT,
  shellInputFiles = listShellInputRepoFiles(repoRoot, ['patches']),
) {
  const platformPathPattern =
    platform === 'android'
      ? /(?:^|\/)android(?:\/|$)|\.(?:gradle|java|kt|kts)$/iu
      : /(?:^|\/)(?:apple|ios)(?:\/|$)|\.(?:m|mm|podspec|swift)$/iu;
  const sharedNativePathPattern =
    /(?:^|\/)(?:common\/cpp|cpp)(?:\/|$)|\.(?:c|cc|cpp|h|hpp)$/iu;
  return shellInputFiles.filter((relativePath) => {
    if (!relativePath.startsWith('patches/')) return false;
    if (!relativePath.endsWith('.patch')) return false;
    const source = fs.readFileSync(
      path.resolve(repoRoot, relativePath),
      'utf8',
    );
    return source.split('\n').some((line) => {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/u);
      return match
        ? [match[1], match[2]].some(
            (patchPath) =>
              platformPathPattern.test(patchPath) ||
              sharedNativePathPattern.test(patchPath),
          )
        : false;
    });
  });
}

function getNativeContractPatchInputPaths(platform, repoRoot, repoFiles) {
  const sourceExtensions = NATIVE_CONTRACT_SOURCE_EXTENSIONS[platform];
  const nativeBuildExtensions =
    platform === 'android'
      ? new Set(['.cmake', '.gradle', '.kts'])
      : new Set(['.podspec', '.xcconfig']);
  const nativeBuildFileNames =
    platform === 'android'
      ? new Set(['Android.mk', 'Application.mk', 'CMakeLists.txt'])
      : new Set(['Package.swift']);
  return repoFiles.filter((relativePath) => {
    if (!relativePath.startsWith('patches/')) return false;
    if (!relativePath.endsWith('.patch')) return false;
    const source = fs.readFileSync(
      path.resolve(repoRoot, relativePath),
      'utf8',
    );
    return source.split('\n').some((line) => {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/u);
      return match
        ? [match[1], match[2]].some((patchPath) => {
            const extension = path.extname(patchPath).toLowerCase();
            return (
              sourceExtensions.has(extension) ||
              nativeBuildExtensions.has(extension) ||
              nativeBuildFileNames.has(path.basename(patchPath))
            );
          })
        : false;
    });
  });
}

function getAppNativeContractInputPaths(platform, repoRoot = REPO_ROOT) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  const inputDirectories = [
    ...devVendorConfig.nativeContractDirectories.shared,
    ...devVendorConfig.nativeContractDirectories[platform],
  ];
  const configuredFiles = [
    ...devVendorConfig.nativeContractFiles.shared,
    ...devVendorConfig.nativeContractFiles[platform],
  ];
  const sourceExtensions = NATIVE_CONTRACT_SOURCE_EXTENSIONS[platform];
  const configuredNativeSources = configuredFiles.filter((relativePath) =>
    sourceExtensions.has(path.extname(relativePath).toLowerCase()),
  );
  const directoryPrefixes = inputDirectories.map(
    (relativeDirectory) => `${relativeDirectory}/`,
  );
  const repoFiles = listShellInputRepoFiles(repoRoot, [
    ...inputDirectories,
    ...configuredNativeSources,
    'patches',
  ]);
  const nativeSources = repoFiles.filter(
    (relativePath) =>
      directoryPrefixes.some((directoryPrefix) =>
        relativePath.startsWith(directoryPrefix),
      ) && sourceExtensions.has(path.extname(relativePath).toLowerCase()),
  );
  return [
    ...new Set([
      ...configuredNativeSources,
      ...nativeSources,
      ...getNativeContractPatchInputPaths(platform, repoRoot, repoFiles),
    ]),
  ].toSorted();
}

function getNativeContractInputPaths(platform, repoRoot = REPO_ROOT) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  return [
    ...new Set([
      ...devVendorConfig.nativeContractFiles.shared,
      ...devVendorConfig.nativeContractFiles[platform],
      ...getAppNativeContractInputPaths(platform, repoRoot),
    ]),
  ].toSorted();
}

function getShellInputPaths(platform, repoRoot = REPO_ROOT) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  const ignoredDirectories = devVendorConfig.shellInputIgnoredDirectories.map(
    (relativeDirectory) => `${relativeDirectory}/`,
  );
  const inputDirectories = [
    ...devVendorConfig.shellInputDirectories.shared,
    ...devVendorConfig.shellInputDirectories[platform],
  ];
  const directoryPrefixes = inputDirectories.map(
    (relativeDirectory) => `${relativeDirectory}/`,
  );
  const configuredFiles = [
    ...devVendorConfig.shellInputFiles.shared,
    ...devVendorConfig.shellInputFiles[platform],
  ];
  const shellInputFiles = listShellInputRepoFiles(repoRoot, [
    ...inputDirectories,
    ...configuredFiles,
    'patches',
  ]);
  const shellInputFileSet = new Set(shellInputFiles);
  const excludedConfiguredFile = configuredFiles.find(
    (relativePath) => !shellInputFileSet.has(relativePath),
  );
  if (excludedConfiguredFile) {
    throw new Error(
      `[devVendor] Configured shell input is missing or excluded: ${excludedConfiguredFile}`,
    );
  }
  const directoryFiles = shellInputFiles
    .filter((relativePath) =>
      directoryPrefixes.some((directoryPrefix) =>
        relativePath.startsWith(directoryPrefix),
      ),
    )
    .filter(
      (relativePath) =>
        !ignoredDirectories.some((ignoredDirectory) =>
          relativePath.startsWith(ignoredDirectory),
        ),
    );
  return [
    ...new Set([
      ...configuredFiles,
      ...directoryFiles,
      ...getNativePatchInputPaths(platform, repoRoot, shellInputFiles),
    ]),
  ].toSorted();
}

function readYarnScalar(value) {
  if (value.startsWith('"')) return JSON.parse(value);
  return value;
}

function getYarnDescriptor(packageName, requested) {
  const protocolPattern =
    /^(?:exec|file|git|https?|link|patch|portal|workspace):/u;
  return `${packageName}@${
    requested.startsWith('npm:') || protocolPattern.test(requested)
      ? requested
      : `npm:${requested}`
  }`;
}

function versionMatchesRequested(version, requested) {
  const aliasVersion = requested.startsWith('npm:')
    ? requested.slice(requested.lastIndexOf('@') + 1)
    : requested;
  const match = aliasVersion.match(/^(\^|~)?(\d+)\.(\d+)\.(\d+)/u);
  const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)/u);
  if (!match || !versionMatch) return false;
  const requestedParts = match.slice(2).map(Number);
  const versionParts = versionMatch.slice(1).map(Number);
  if (!match[1]) {
    return requestedParts.every((part, index) => part === versionParts[index]);
  }
  if (match[1] === '~') {
    return (
      requestedParts[0] === versionParts[0] &&
      requestedParts[1] === versionParts[1] &&
      versionParts[2] >= requestedParts[2]
    );
  }
  const isAtLeastRequested = versionParts.some(
    (part, index) =>
      part > requestedParts[index] &&
      versionParts
        .slice(0, index)
        .every(
          (prefixPart, prefixIndex) =>
            prefixPart === requestedParts[prefixIndex],
        ),
  );
  return (
    requestedParts[0] === versionParts[0] &&
    (requestedParts.every((part, index) => part === versionParts[index]) ||
      isAtLeastRequested)
  );
}

function readInstalledPackageVersion(packageName, repoRoot) {
  const packagePath = path.join(
    repoRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );
  if (!fs.existsSync(packagePath)) return undefined;
  return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
}

function readYarnResolutions(dependencies, repoRoot) {
  const descriptorSet = new Set(
    dependencies.map(({ descriptor }) => descriptor),
  );
  const resolutions = new Map();
  const candidates = new Map(dependencies.map(({ name }) => [name, []]));
  let activeDescriptors = [];
  let activeNames = [];
  let activeResolution;

  const flush = () => {
    if (activeDescriptors.length === 0 && activeNames.length === 0) return;
    if (!activeResolution?.resolution || !activeResolution.version) {
      throw new Error(
        `[devVendor] Invalid yarn.lock entry: ${activeDescriptors[0] || activeNames[0]}`,
      );
    }
    for (const descriptor of activeDescriptors) {
      resolutions.set(descriptor, activeResolution);
    }
    for (const name of activeNames) candidates.get(name).push(activeResolution);
  };

  const lockSource = fs.readFileSync(path.join(repoRoot, 'yarn.lock'), 'utf8');
  for (const line of lockSource.split('\n')) {
    if (line && !line.startsWith(' ') && line.endsWith(':')) {
      flush();
      const rawKey = line.slice(0, -1);
      const key = rawKey.startsWith('"') ? JSON.parse(rawKey) : rawKey;
      activeDescriptors = key
        .split(', ')
        .filter((descriptor) => descriptorSet.has(descriptor));
      activeNames = dependencies
        .filter(({ name }) =>
          key
            .split(', ')
            .some((descriptor) => descriptor.startsWith(`${name}@`)),
        )
        .map(({ name }) => name);
      activeResolution =
        activeDescriptors.length > 0 || activeNames.length > 0 ? {} : undefined;
    } else if (activeResolution) {
      const field = line.match(/^  (checksum|resolution|version): (.+)$/u);
      if (field) activeResolution[field[1]] = readYarnScalar(field[2]);
    }
  }
  flush();

  for (const { descriptor, name, requested } of dependencies) {
    if (!resolutions.has(descriptor)) {
      const installedVersion = readInstalledPackageVersion(name, repoRoot);
      const matchingCandidates = candidates
        .get(name)
        .filter(({ version }) =>
          installedVersion
            ? version === installedVersion
            : versionMatchesRequested(version, requested),
        );
      if (matchingCandidates.length === 1) {
        resolutions.set(descriptor, matchingCandidates[0]);
      } else {
        throw new Error(
          `[devVendor] Native ABI dependency is missing from yarn.lock: ${descriptor}`,
        );
      }
    }
  }
  return resolutions;
}

function readKeyValueProperties(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim(),
        ];
      }),
  );
}

function getPodRootName(requirement) {
  return requirement.split(' (', 1)[0].split('/', 1)[0];
}

function readCocoaPodsLockScalar(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('"')) {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'string') {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
    return parsed;
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function getCocoaPodsLockSections(source) {
  const sections = new Map();
  let activeSection;
  for (const line of source.split('\n')) {
    const section = line.match(/^([A-Z][A-Z ]+):$/u);
    if (section) {
      activeSection = section[1];
      sections.set(activeSection, []);
    } else if (activeSection && line.startsWith(' ')) {
      sections.get(activeSection).push(line);
    } else if (line.trim()) {
      activeSection = undefined;
    }
  }
  return sections;
}

function readCocoaPodsLock(repoRoot) {
  const sections = getCocoaPodsLockSections(
    fs.readFileSync(
      path.join(repoRoot, 'apps/mobile/ios/Podfile.lock'),
      'utf8',
    ),
  );
  const podLines = sections.get('PODS');
  const dependencyLines = sections.get('DEPENDENCIES');
  const checksumLines = sections.get('SPEC CHECKSUMS');
  if (!podLines || !dependencyLines || !checksumLines) {
    throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
  }

  const pods = [];
  let activePod;
  for (const line of podLines) {
    if (line.startsWith('  - ')) {
      let requirement = line.slice(4);
      if (requirement.endsWith(':')) requirement = requirement.slice(0, -1);
      activePod = {
        dependencies: [],
        requirement: readCocoaPodsLockScalar(requirement),
      };
      pods.push(activePod);
    } else if (line.startsWith('    - ') && activePod) {
      activePod.dependencies.push(readCocoaPodsLockScalar(line.slice(6)));
    } else if (line.trim()) {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
  }

  const dependencies = dependencyLines.map((line) => {
    if (!line.startsWith('  - ')) {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
    return readCocoaPodsLockScalar(line.slice(4));
  });
  const specChecksums = new Map();
  for (const line of checksumLines) {
    const checksum = line.match(/^  (.+): ([0-9a-f]{40})$/u);
    if (!checksum) {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
    specChecksums.set(readCocoaPodsLockScalar(checksum[1]), checksum[2]);
  }

  const checkoutOptions = new Map();
  let activeCheckout;
  for (const line of sections.get('CHECKOUT OPTIONS') || []) {
    const checkout = line.match(/^  (.+):$/u);
    const option = line.match(/^    (:[^:]+): (.+)$/u);
    if (checkout) {
      activeCheckout = new Map();
      checkoutOptions.set(readCocoaPodsLockScalar(checkout[1]), activeCheckout);
    } else if (option && activeCheckout) {
      activeCheckout.set(option[1], readCocoaPodsLockScalar(option[2]));
    } else if (line.trim()) {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
  }
  return { checkoutOptions, dependencies, pods, specChecksums };
}

function getIosNativePodDescriptor(dependencyNames, repoRoot) {
  const lock = readCocoaPodsLock(repoRoot);

  const dependencyNameSet = new Set(dependencyNames);
  const linkedPackages = new Set();
  const directPods = new Set();
  for (const dependency of lock.dependencies) {
    const packageMatch = dependency.match(
      /node_modules\/((?:@[^/`]+\/)?[^/`]+)/u,
    );
    if (packageMatch && dependencyNameSet.has(packageMatch[1])) {
      linkedPackages.add(packageMatch[1]);
      directPods.add(getPodRootName(dependency));
    }
  }
  const missingPackage = dependencyNames.find(
    (name) => name !== 'hermes-compiler' && !linkedPackages.has(name),
  );
  if (missingPackage) {
    throw new Error(
      `[devVendor] Native ABI dependency is missing from Podfile.lock: ${missingPackage}`,
    );
  }

  const pods = new Map();
  for (const { dependencies: podDependencies, requirement } of lock.pods) {
    const match = requirement.match(/^(.+) \(([^)]+)\)$/u);
    if (!match) {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
    const name = getPodRootName(match[1]);
    const version = match[2];
    const existing = pods.get(name);
    if (existing && existing.version !== version) {
      throw new Error(
        `[devVendor] CocoaPods resolved conflicting versions for ${name}.`,
      );
    }
    const dependencies = new Set(existing?.dependencies || []);
    for (const dependency of podDependencies) {
      dependencies.add(getPodRootName(dependency));
    }
    pods.set(name, { dependencies, version });
  }

  const resolvedPods = new Set();
  const pendingPods = [...directPods];
  while (pendingPods.length > 0) {
    const name = pendingPods.pop();
    if (!resolvedPods.has(name)) {
      const pod = pods.get(name);
      if (!pod) {
        throw new Error(`[devVendor] CocoaPods resolution is missing: ${name}`);
      }
      resolvedPods.add(name);
      pendingPods.push(...pod.dependencies);
    }
  }
  return [...resolvedPods].toSorted().map((name) => {
    const checksum = lock.specChecksums.get(name);
    if (!/^[0-9a-f]{40}$/u.test(checksum || '')) {
      throw new Error(`[devVendor] CocoaPods checksum is missing: ${name}`);
    }
    const checkout = [
      ...(lock.checkoutOptions.get(name)?.entries() || []),
    ].toSorted(([first], [second]) => compareModuleKeys(first, second));
    return { checkout, checksum, name, version: pods.get(name).version };
  });
}

function getNativeContractDescriptor(platform, repoRoot = REPO_ROOT) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'apps/mobile/package.json'), 'utf8'),
  );
  const dependencyNames = [
    ...devVendorConfig.nativeContractDependencies.shared,
    ...devVendorConfig.nativeContractDependencies[platform],
  ].toSorted();
  const dependencies = dependencyNames.map((name) => {
    const directRequested =
      packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
    const requested =
      directRequested ?? readInstalledPackageVersion(name, repoRoot);
    if (typeof requested !== 'string' || !requested) {
      throw new Error(
        `[devVendor] Native ABI dependency is not installed: ${name}`,
      );
    }
    return { descriptor: getYarnDescriptor(name, requested), name, requested };
  });
  const resolutions = readYarnResolutions(dependencies, repoRoot);
  let engine;
  if (platform === 'android') {
    const properties = readKeyValueProperties(
      path.join(repoRoot, 'apps/mobile/android/gradle.properties'),
    );
    engine = {
      hermes: properties.hermesEnabled,
      newArchitecture: properties.newArchEnabled,
    };
  } else {
    const properties = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, 'apps/mobile/ios/Podfile.properties.json'),
        'utf8',
      ),
    );
    engine = {
      hermes: properties['expo.jsEngine'],
      newArchitecture: properties['expo.newArchEnabled'],
    };
  }
  if (!engine.hermes || !engine.newArchitecture) {
    throw new Error('[devVendor] Native engine ABI configuration is missing.');
  }
  return {
    appNativeInputsDigest: hashRepoFiles(
      getAppNativeContractInputPaths(platform, repoRoot),
      repoRoot,
    ),
    dependencies: dependencies.map(({ descriptor, name, requested }) => {
      const resolution = resolutions.get(descriptor);
      return {
        checksum: resolution.checksum || null,
        name,
        requested,
        resolution: resolution.resolution,
        version: resolution.version,
      };
    }),
    engine,
    loaderProtocolVersion: devVendorConfig.NATIVE_LOADER_PROTOCOL_VERSION,
    platform,
    pods:
      platform === 'ios'
        ? getIosNativePodDescriptor(dependencyNames, repoRoot)
        : [],
    vendorSchemaVersion: devVendorConfig.SCHEMA_VERSION,
    vendorStrategyVersion: devVendorConfig.STRATEGY_VERSION,
  };
}

function hashRepoFiles(relativePaths, repoRoot = REPO_ROOT) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[devVendor] Fingerprint input is missing: ${relativePath}`,
      );
    }
    hash.update(relativePath);
    hash.update('\0');
    hash.update(
      Buffer.from(
        fs
          .readFileSync(absolutePath)
          .toString('latin1')
          .replaceAll('\r\n', '\n'),
        'latin1',
      ),
    );
    hash.update('\0');
  }
  return hash.digest('hex');
}

function normalizeShellInputContent(relativePath, content) {
  if (
    SHELL_INPUT_BINARY_EXTENSIONS.has(path.extname(relativePath)) ||
    content.includes(0)
  ) {
    return content;
  }
  try {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(content);
    return Buffer.from(source.replaceAll('\r\n', '\n'));
  } catch {
    return content;
  }
}

function hashShellInputFiles(relativePaths, repoRoot = REPO_ROOT) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of relativePaths) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`[devVendor] Shell input is missing: ${relativePath}`);
    }
    hash.update(relativePath);
    hash.update('\0');
    hash.update(
      normalizeShellInputContent(relativePath, fs.readFileSync(absolutePath)),
    );
    hash.update('\0');
  }
  return hash.digest('hex');
}

function computeRegistryInputsDigest(registry = loadRegistry()) {
  const selectRelevantEntries = (entries) =>
    Object.entries(entries)
      .filter(([moduleKey]) =>
        ['nodeModules', 'virtual'].includes(getModuleIdDomain(moduleKey)),
      )
      .toSorted(([first], [second]) => compareModuleKeys(first, second));

  return sha256(
    JSON.stringify({
      allocationVersion: registry.allocationVersion,
      modules: selectRelevantEntries(registry.modules),
      ranges: registry.ranges,
      registryEpoch: registry.registryEpoch,
      tombstones: selectRelevantEntries(registry.tombstones),
    }),
  );
}

function computeConfigInputsDigest(
  repoRoot = REPO_ROOT,
  env = process.env,
  registry = loadRegistry(),
) {
  return sha256(
    JSON.stringify({
      files: hashRepoFiles(getFingerprintInputPaths(repoRoot), repoRoot),
      registry: computeRegistryInputsDigest(registry),
      transformationEnvironment:
        devVendorConfig.getTransformationEnvironment(env),
    }),
  );
}

function computeNativeContractKey(platform, repoRoot = REPO_ROOT) {
  const descriptor = getNativeContractDescriptor(platform, repoRoot);
  return sha256(
    [
      `onekey-native-dev-shell-contract-v${devVendorConfig.NATIVE_CONTRACT_VERSION}`,
      `platform=${descriptor.platform}`,
      `loader-protocol=${descriptor.loaderProtocolVersion}`,
      `vendor-schema=${descriptor.vendorSchemaVersion}`,
      `vendor-strategy=${descriptor.vendorStrategyVersion}`,
      `app-native-inputs=${descriptor.appNativeInputsDigest}`,
      `engine.hermes=${descriptor.engine.hermes}`,
      `engine.new-architecture=${descriptor.engine.newArchitecture}`,
      ...descriptor.dependencies.map(
        ({ checksum, name, resolution, version }) =>
          [name, resolution, version, checksum || ''].join('\0'),
      ),
      ...descriptor.pods.map(({ checkout, checksum, name, version }) =>
        [
          'pod',
          name,
          version,
          checksum,
          ...checkout.flatMap(([key, value]) => [key, value]),
        ].join('\0'),
      ),
    ].join('\0'),
  );
}

function computeShellCompatibilityKey({
  nativeContractKey,
  platform,
  webEmbedInputKey,
}) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  if (!/^[0-9a-f]{64}$/u.test(nativeContractKey || '')) {
    throw new Error('[devVendor] Invalid native contract key.');
  }
  if (!/^[0-9a-f]{64}$/u.test(webEmbedInputKey || '')) {
    throw new Error('[devVendor] Invalid web-embed input key.');
  }
  const architecture = platform === 'android' ? 'arm64-v8a' : 'arm64';
  return sha256(
    [
      'onekey-mobile-dev-shell-compatibility-v3',
      `platform=${platform}`,
      `architecture=${architecture}`,
      `native-contract=${nativeContractKey}`,
      `web-embed=${webEmbedInputKey}`,
      '',
    ].join('\0'),
  );
}

function computeShellInputKey(
  { nativeContractKey, platform, webEmbedInputKey },
  repoRoot = REPO_ROOT,
) {
  const shellCompatibilityKey = computeShellCompatibilityKey({
    nativeContractKey,
    platform,
    webEmbedInputKey,
  });
  return sha256(
    [
      'onekey-mobile-dev-shell-input-v3',
      `compatibility=${shellCompatibilityKey}`,
      hashShellInputFiles(getShellInputPaths(platform, repoRoot), repoRoot),
      '',
    ].join('\0'),
  );
}

function computeReleaseCompatibilityKey(
  repoRoot = REPO_ROOT,
  env = process.env,
  registry = loadRegistry(),
) {
  return sha256(
    JSON.stringify({
      configInputsDigest: computeConfigInputsDigest(repoRoot, env, registry),
      nativeContractKeys: Object.fromEntries(
        [...SUPPORTED_PLATFORMS]
          .toSorted()
          .map((platform) => [
            platform,
            computeNativeContractKey(platform, repoRoot),
          ]),
      ),
      releaseInputsDigest: hashRepoFiles(
        devVendorConfig.releaseFingerprintFiles,
        repoRoot,
      ),
      registryEpoch: registry.registryEpoch,
      schemaVersion: devVendorConfig.SCHEMA_VERSION,
      strategyVersion: devVendorConfig.STRATEGY_VERSION,
    }),
  );
}

function getReleaseTag(repoRoot = REPO_ROOT, env = process.env) {
  return `${devVendorConfig.releaseTagPrefix}-${computeReleaseCompatibilityKey(
    repoRoot,
    env,
  )}`;
}

function computeModulesDigest(modules, repoRoot = REPO_ROOT) {
  const hash = crypto.createHash('sha256');
  for (const moduleRecord of modules) {
    const absolutePath = path.resolve(repoRoot, moduleRecord.path);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[devVendor] Common module is missing: ${moduleRecord.path}`,
      );
    }
    const sourceSha256 = sha256(fs.readFileSync(absolutePath));
    hash.update(moduleRecord.path);
    hash.update('\0');
    hash.update(String(moduleRecord.id));
    hash.update('\0');
    hash.update(sourceSha256);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function computeFingerprint(manifestFields) {
  return sha256(
    JSON.stringify({
      schemaVersion: manifestFields.schemaVersion,
      strategyVersion: manifestFields.strategyVersion,
      platform: manifestFields.platform,
      registryEpoch: manifestFields.registryEpoch,
      configInputsDigest: manifestFields.configInputsDigest,
      nativeContractKey: manifestFields.nativeContractKey,
      modulesDigest: manifestFields.modulesDigest,
      modules: manifestFields.modules.map(({ id, path: modulePath }) => ({
        id,
        path: modulePath,
      })),
      prependModules: manifestFields.prependModules.map(
        ({ id, path: modulePath }) => ({
          id,
          path: modulePath,
        }),
      ),
    }),
  );
}

function getPlatformOutputDirectory(projectRoot, platform) {
  return path.join(devVendorConfig.outputRoot(projectRoot), platform);
}

function getManifestPath(projectRoot, platform) {
  return path.join(
    getPlatformOutputDirectory(projectRoot, platform),
    MANIFEST_NAME,
  );
}

function getStubRoot(projectRoot, platform) {
  return path.join(getPlatformOutputDirectory(projectRoot, platform), 'stubs');
}

function getStubPath(projectRoot, platform, moduleId) {
  return path.join(getStubRoot(projectRoot, platform), `${moduleId}.js`);
}

function getRuntimeCacheKey(projectRoot, platform, repoRoot = REPO_ROOT) {
  return `${path.resolve(projectRoot)}:${platform}:${path.resolve(repoRoot)}`;
}

function getFileIdentity(filePath) {
  const stat = fs.statSync(filePath, { bigint: true });
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
}

function captureFileIdentities(filePaths) {
  return new Map(
    filePaths.map((filePath) => [filePath, getFileIdentity(filePath)]),
  );
}

function fileIdentitiesMatch(fileIdentities) {
  try {
    return [...fileIdentities].every(
      ([filePath, identity]) => getFileIdentity(filePath) === identity,
    );
  } catch {
    return false;
  }
}

function isPathInsideDirectory(filePath, directoryPath) {
  const relativePath = path.relative(directoryPath, filePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function getDevVendorStubInfo(filePath, projectRoot) {
  const outputRoot = path.resolve(devVendorConfig.outputRoot(projectRoot));
  const relativePath = path.relative(outputRoot, path.resolve(filePath));
  if (
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return undefined;
  }
  const match = relativePath.match(/^(android|ios)[\\/]stubs[\\/](\d+)\.js$/);
  if (!match) {
    return undefined;
  }
  const moduleId = Number(match[2]);
  return Number.isSafeInteger(moduleId) && moduleId > 0
    ? { moduleId, platform: match[1] }
    : undefined;
}

function getDevVendorStubModuleId(filePath, projectRoot) {
  return getDevVendorStubInfo(filePath, projectRoot)?.moduleId;
}

function assertSortedUniqueModules(modules) {
  const paths = modules.map((moduleRecord) => moduleRecord.path);
  const sortedPaths = paths.toSorted(compareModuleKeys);
  if (paths.some((modulePath, index) => modulePath !== sortedPaths[index])) {
    throw new Error('[devVendor] Manifest modules must be sorted by path.');
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error('[devVendor] Manifest contains duplicate module paths.');
  }
  const ids = modules.map((moduleRecord) => moduleRecord.id);
  if (
    ids.some((moduleId) => !Number.isSafeInteger(moduleId) || moduleId <= 0)
  ) {
    throw new Error('[devVendor] Manifest contains an invalid module ID.');
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('[devVendor] Manifest contains duplicate module IDs.');
  }
}

function verifyManifest({
  artifactDirectory,
  manifest,
  platform,
  projectRoot,
  repoRoot = REPO_ROOT,
}) {
  if (manifest.schemaVersion !== devVendorConfig.SCHEMA_VERSION) {
    throw new Error(
      `[devVendor] Unsupported manifest schema ${String(manifest.schemaVersion)}. Rebuild the dev vendor cache.`,
    );
  }
  if (manifest.strategyVersion !== devVendorConfig.STRATEGY_VERSION) {
    throw new Error(
      `[devVendor] Unsupported strategy ${String(manifest.strategyVersion)}. Rebuild the dev vendor cache.`,
    );
  }
  if (manifest.platform !== platform) {
    throw new Error(
      `[devVendor] Manifest platform ${String(manifest.platform)} does not match ${platform}.`,
    );
  }
  if (!Array.isArray(manifest.modules)) {
    throw new Error('[devVendor] Manifest modules must be an array.');
  }
  assertSortedUniqueModules(manifest.modules);
  if (!Array.isArray(manifest.prependModules)) {
    throw new Error('[devVendor] Manifest prependModules must be an array.');
  }
  assertSortedUniqueModules(manifest.prependModules);

  const registry = loadRegistry();
  if (manifest.registryEpoch !== registry.registryEpoch) {
    throw new Error(
      `[devVendor] Registry epoch mismatch for ${platform}. Rebuild the dev vendor cache.`,
    );
  }
  for (const moduleRecord of [
    ...manifest.modules,
    ...manifest.prependModules,
  ]) {
    if (registry.modules[moduleRecord.path] !== moduleRecord.id) {
      throw new Error(
        `[devVendor] Stable module ID mismatch for ${moduleRecord.path}. Rebuild the dev vendor cache.`,
      );
    }
  }

  const configInputsDigest = computeConfigInputsDigest(repoRoot);
  if (manifest.configInputsDigest !== configInputsDigest) {
    throw new Error(
      `[devVendor] Build configuration changed for ${platform}. Run the dev-vendor build again.`,
    );
  }
  const nativeContractKey = computeNativeContractKey(platform, repoRoot);
  if (manifest.nativeContractKey !== nativeContractKey) {
    throw new Error(
      `[devVendor] Native contract changed for ${platform}. Rebuild the dev vendor cache.`,
    );
  }
  const modulesDigest = computeModulesDigest(manifest.modules, repoRoot);
  if (manifest.modulesDigest !== modulesDigest) {
    throw new Error(
      `[devVendor] Common module sources changed for ${platform}. Run the dev-vendor build again.`,
    );
  }
  const fingerprint = computeFingerprint({
    ...manifest,
    configInputsDigest,
    modulesDigest,
  });
  if (manifest.fingerprint !== fingerprint) {
    throw new Error(
      `[devVendor] Fingerprint mismatch for ${platform}. Rebuild the dev vendor cache.`,
    );
  }

  const resolvedArtifactDirectory =
    artifactDirectory ?? getPlatformOutputDirectory(projectRoot, platform);
  for (const artifact of [manifest.common.source, manifest.common.bytecode]) {
    const artifactPath = path.join(resolvedArtifactDirectory, artifact.file);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(
        `[devVendor] Cached artifact is missing: ${artifactPath}`,
      );
    }
    const bytes = fs.readFileSync(artifactPath);
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      throw new Error(
        `[devVendor] Cached artifact integrity mismatch: ${artifactPath}`,
      );
    }
  }
  for (const moduleRecord of manifest.modules) {
    const stubPath = path.join(
      resolvedArtifactDirectory,
      'stubs',
      `${moduleRecord.id}.js`,
    );
    if (!fs.existsSync(stubPath)) {
      throw new Error(
        `[devVendor] External stub is missing for module ${moduleRecord.id}. Rebuild the dev vendor cache.`,
      );
    }
  }

  return manifest;
}

function loadRuntime(
  projectRoot,
  platform,
  { repoRoot = REPO_ROOT, validateArtifacts = false } = {},
) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  const cacheKey = getRuntimeCacheKey(projectRoot, platform, repoRoot);
  const cachedRuntime = runtimeCache.get(cacheKey);
  if (
    cachedRuntime &&
    (!validateArtifacts ||
      fileIdentitiesMatch(cachedRuntime.artifactFileIdentities))
  ) {
    return cachedRuntime;
  }
  runtimeCache.delete(cacheKey);
  const manifestPath = getManifestPath(projectRoot, platform);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `[devVendor] Missing ${platform} cache. Run \`yarn workspace @onekeyhq/mobile dev-vendor:build --platform ${platform}\` first.`,
    );
  }
  const manifest = verifyManifest({
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
    platform,
    projectRoot,
    repoRoot,
  });
  const moduleByAbsolutePath = new Map(
    manifest.modules.map((moduleRecord) => [
      path.resolve(repoRoot, moduleRecord.path),
      moduleRecord,
    ]),
  );
  const sourcePath = path.join(
    getPlatformOutputDirectory(projectRoot, platform),
    manifest.common.source.file,
  );
  const bytecodePath = path.join(
    getPlatformOutputDirectory(projectRoot, platform),
    manifest.common.bytecode.file,
  );
  const artifactPaths = [manifestPath, sourcePath, bytecodePath].map(
    (filePath) => path.resolve(filePath),
  );
  const runtime = {
    artifactFileIdentities: captureFileIdentities(artifactPaths),
    artifactPaths: new Set(artifactPaths),
    fingerprintDirectories: devVendorConfig.fingerprintDirectories.map(
      (relativeDirectory) => path.resolve(repoRoot, relativeDirectory),
    ),
    fingerprintFiles: new Set(
      devVendorConfig.fingerprintFiles.map((relativePath) =>
        path.resolve(repoRoot, relativePath),
      ),
    ),
    manifest,
    moduleByAbsolutePath,
    sourceCode: fs.readFileSync(sourcePath, 'utf8'),
  };
  runtimeCache.set(cacheKey, runtime);
  console.log(
    `[devVendor] cache hit platform=${platform} fingerprint=${manifest.fingerprint} modules=${manifest.modules.length} commonBytes=${manifest.common.source.bytes}`,
  );
  return runtime;
}

function isRuntimeInputPath(runtime, filePath) {
  const absolutePath = path.resolve(filePath);
  return (
    runtime.artifactPaths.has(absolutePath) ||
    runtime.fingerprintFiles.has(absolutePath) ||
    runtime.moduleByAbsolutePath.has(absolutePath) ||
    runtime.fingerprintDirectories.some((directoryPath) =>
      isPathInsideDirectory(absolutePath, directoryPath),
    )
  );
}

function refreshRuntimeCacheForChanges({
  changedFiles,
  platform,
  projectRoot,
  repoRoot = REPO_ROOT,
}) {
  const cacheKey = getRuntimeCacheKey(projectRoot, platform, repoRoot);
  const runtime = runtimeCache.get(cacheKey);
  if (
    !runtime ||
    ![...changedFiles].some((filePath) => isRuntimeInputPath(runtime, filePath))
  ) {
    return runtime;
  }
  runtimeCache.delete(cacheKey);
  return loadRuntime(projectRoot, platform, { repoRoot });
}

function isDevVendorRequest(bundleOptions) {
  try {
    const sourceUrl = new URL(bundleOptions.sourceUrl);
    return sourceUrl.searchParams.get('resolver.devVendor') === 'true';
  } catch {
    return false;
  }
}

function assertNativeDevVendorResolverContract({
  customResolverOptions,
  env = process.env,
  manifest,
  platform,
}) {
  if (customResolverOptions?.devVendorNative !== 'true') {
    return;
  }
  const requestedFingerprint = customResolverOptions.devVendorFingerprint;
  if (
    typeof requestedFingerprint !== 'string' ||
    requestedFingerprint !== manifest.fingerprint
  ) {
    throw new Error(
      `[devVendor] Native ${platform} cache fingerprint mismatch. Rebuild the dev-vendor cache and native app.`,
    );
  }
  const runtimeTarget = customResolverOptions.runtimeTarget;
  if (!SUPPORTED_RUNTIME_TARGETS.has(runtimeTarget)) {
    throw new Error(
      `[devVendor] Native ${platform} request has an invalid runtime target: ${String(runtimeTarget)}.`,
    );
  }
  const requestedSessionId = customResolverOptions.devSessionId;
  const serverSessionId = env.ONEKEY_DEV_SESSION_ID;
  if (customResolverOptions.devVendorEmbedded === 'true') {
    // Xcode/Gradle Debug builds embed the validated common HBC + manifest and
    // run against a plain `yarn app:native-bundle` Metro. They have no
    // DevSession, so they may only be served by a Metro server that is not
    // bound to a DevSession either; DevSession isolation stays intact.
    if (requestedSessionId !== undefined) {
      throw new Error(
        `[devVendor] Native ${platform} embedded request must not carry a dev session ID.`,
      );
    }
    if (typeof serverSessionId === 'string' && serverSessionId.length > 0) {
      throw new Error(
        `[devVendor] Native ${platform} embedded request reached a DevSession Metro server.`,
      );
    }
    return;
  }
  if (
    typeof requestedSessionId !== 'string' ||
    !DEV_SESSION_ID_PATTERN.test(requestedSessionId)
  ) {
    throw new Error(
      `[devVendor] Native ${platform} request has an invalid dev session ID.`,
    );
  }
  if (
    typeof serverSessionId !== 'string' ||
    !DEV_SESSION_ID_PATTERN.test(serverSessionId)
  ) {
    throw new Error(
      `[devVendor] Native ${platform} Metro server has no valid ONEKEY_DEV_SESSION_ID.`,
    );
  }
  if (requestedSessionId !== serverSessionId) {
    throw new Error(
      `[devVendor] Native ${platform} request dev session does not match this Metro server.`,
    );
  }
}

function assertNativeDevVendorServerEnabled(customResolverOptions, enabled) {
  if (customResolverOptions?.devVendorNative === 'true' && !enabled) {
    throw new Error(
      '[devVendor] Native dev-vendor request reached a Metro server without ONEKEY_DEV_VENDOR=true.',
    );
  }
}

function getRuntimeTarget(entryPoint, projectRoot) {
  const resolvedEntryPoint = path.resolve(entryPoint);
  if (resolvedEntryPoint === path.resolve(projectRoot, 'index.ts')) {
    return 'main';
  }
  if (resolvedEntryPoint === path.resolve(projectRoot, 'background.ts')) {
    return 'background';
  }
  return undefined;
}

function inspectDevVendorGraph({ entryPoint, graph, projectRoot }) {
  const stubInfos = [...graph.dependencies.keys()]
    .map((modulePath) => getDevVendorStubInfo(modulePath, projectRoot))
    .filter(Boolean);
  if (stubInfos.length === 0) return undefined;

  const platform = graph.transformOptions?.platform;
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(
      `[devVendor] External stubs found for unsupported platform: ${String(platform)}.`,
    );
  }
  const mismatchedStub = stubInfos.find(
    (stubInfo) => stubInfo.platform !== platform,
  );
  if (mismatchedStub) {
    throw new Error(
      `[devVendor] ${mismatchedStub.platform} external stub found in ${platform} graph.`,
    );
  }
  const runtimeTarget = getRuntimeTarget(entryPoint, projectRoot);
  if (!runtimeTarget) {
    throw new Error(
      `[devVendor] External stubs found for unsupported runtime entry: ${entryPoint}.`,
    );
  }
  return { platform, runtimeTarget, stubCount: stubInfos.length };
}

function shouldPrependCommon(bundleOptions, devVendorGraph) {
  return (
    bundleOptions.dev &&
    !bundleOptions.modulesOnly &&
    devVendorGraph !== undefined
  );
}

function composeDevVendorBundle({
  bundleOptions,
  commonSourceCode,
  devVendorGraph,
  serializedDelta,
}) {
  if (!shouldPrependCommon(bundleOptions, devVendorGraph)) {
    return serializedDelta;
  }
  const deltaCode =
    typeof serializedDelta === 'string'
      ? serializedDelta
      : serializedDelta.code;
  return `${commonSourceCode}\n${deltaCode}`;
}

function serializeDefault(entryPoint, prepend, graph, bundleOptions) {
  const metroRoot = path.resolve(__dirname, '../../../node_modules/metro/src');
  const baseJSBundle = require(
    path.join(metroRoot, 'DeltaBundler/Serializers/baseJSBundle'),
  ).default;
  const bundleToString = require(
    path.join(metroRoot, 'lib/bundleToString'),
  ).default;
  return bundleToString(baseJSBundle(entryPoint, prepend, graph, bundleOptions))
    .code;
}

function applyDevVendorConfig(config, projectRoot) {
  const enabled = isDevVendorEnabled();
  if (!enabled) {
    const previousResolveRequest = config.resolver.resolveRequest;
    config.resolver.resolveRequest = (context, moduleName, platform) => {
      assertNativeDevVendorServerEnabled(
        context.customResolverOptions,
        enabled,
      );
      return previousResolveRequest(context, moduleName, platform);
    };
    return config;
  }

  const previousResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const customResolverOptions = context.customResolverOptions;
    const isNativeRequest = customResolverOptions?.devVendorNative === 'true';
    if (isNativeRequest && customResolverOptions.devVendor !== 'true') {
      throw new Error(
        '[devVendor] Native request is missing resolver.devVendor=true.',
      );
    }
    if (isNativeRequest && !SUPPORTED_PLATFORMS.has(platform)) {
      throw new Error(
        `[devVendor] Native request has an unsupported platform: ${String(platform)}.`,
      );
    }
    if (
      customResolverOptions?.devVendor !== 'true' ||
      !SUPPORTED_PLATFORMS.has(platform)
    ) {
      return previousResolveRequest(context, moduleName, platform);
    }
    let runtime = loadRuntime(projectRoot, platform);
    if (
      isNativeRequest &&
      customResolverOptions.devVendorFingerprint !==
        runtime.manifest.fingerprint
    ) {
      runtimeCache.delete(getRuntimeCacheKey(projectRoot, platform));
      runtime = loadRuntime(projectRoot, platform);
    }
    assertNativeDevVendorResolverContract({
      customResolverOptions,
      manifest: runtime.manifest,
      platform,
    });
    const resolution = previousResolveRequest(context, moduleName, platform);
    if (resolution.type !== 'sourceFile') {
      return resolution;
    }
    const moduleRecord = runtime.moduleByAbsolutePath.get(
      path.resolve(resolution.filePath),
    );
    if (!moduleRecord) {
      return resolution;
    }
    return {
      type: 'sourceFile',
      filePath: getStubPath(projectRoot, platform, moduleRecord.id),
    };
  };

  const previousProcessModuleFilter =
    config.serializer.processModuleFilter || (() => true);
  config.serializer.processModuleFilter = (moduleData) =>
    getDevVendorStubModuleId(moduleData.path, projectRoot) === undefined &&
    previousProcessModuleFilter(moduleData);

  const previousExperimentalSerializerHook =
    config.serializer.experimentalSerializerHook || (() => {});
  config.serializer.experimentalSerializerHook = (graph, delta) => {
    previousExperimentalSerializerHook(graph, delta);
    const platform = graph.transformOptions?.platform;
    const changedFiles = delta?.unstable_changedFiles;
    if (
      SUPPORTED_PLATFORMS.has(platform) &&
      changedFiles instanceof Set &&
      changedFiles.size > 0
    ) {
      refreshRuntimeCacheForChanges({
        changedFiles,
        platform,
        projectRoot,
      });
    }
  };

  const previousCustomSerializer = config.serializer.customSerializer;
  config.serializer.customSerializer = async (
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  ) => {
    const devVendorGraph = bundleOptions.dev
      ? inspectDevVendorGraph({ entryPoint, graph, projectRoot })
      : undefined;
    if (!devVendorGraph) {
      return previousCustomSerializer
        ? previousCustomSerializer(entryPoint, prepend, graph, bundleOptions)
        : serializeDefault(entryPoint, prepend, graph, bundleOptions);
    }
    const runtime = loadRuntime(projectRoot, devVendorGraph.platform, {
      validateArtifacts: true,
    });
    const deltaBundleOptions = {
      ...bundleOptions,
      modulesOnly: true,
    };
    const serializedDelta = previousCustomSerializer
      ? await previousCustomSerializer(
          entryPoint,
          prepend,
          graph,
          deltaBundleOptions,
        )
      : serializeDefault(entryPoint, prepend, graph, deltaBundleOptions);
    const deltaCode =
      typeof serializedDelta === 'string'
        ? serializedDelta
        : serializedDelta.code;
    const deltaModuleCount = graph.dependencies.size - devVendorGraph.stubCount;
    console.log(
      `[devVendor] serialize platform=${devVendorGraph.platform} runtime=${devVendorGraph.runtimeTarget} graph=${graph.dependencies.size} externalStubs=${devVendorGraph.stubCount} deltaModules=${deltaModuleCount} deltaBytes=${Buffer.byteLength(deltaCode)}`,
    );
    return composeDevVendorBundle({
      bundleOptions,
      commonSourceCode: runtime.sourceCode,
      devVendorGraph,
      serializedDelta,
    });
  };

  return config;
}

function resetRuntimeCacheForTests() {
  runtimeCache.clear();
}

module.exports = {
  MANIFEST_NAME,
  SUPPORTED_PLATFORMS,
  SUPPORTED_RUNTIME_TARGETS,
  applyDevVendorConfig,
  assertNativeDevVendorServerEnabled,
  assertNativeDevVendorResolverContract,
  assertSortedUniqueModules,
  computeConfigInputsDigest,
  computeNativeContractKey,
  computeShellCompatibilityKey,
  computeShellInputKey,
  computeFingerprint,
  computeModulesDigest,
  computeRegistryInputsDigest,
  computeReleaseCompatibilityKey,
  composeDevVendorBundle,
  getDevVendorStubModuleId,
  getFingerprintInputPaths,
  getNativeContractInputPaths,
  getNativeContractDescriptor,
  getShellInputPaths,
  getManifestPath,
  getPlatformOutputDirectory,
  getReleaseTag,
  getStubPath,
  hashRepoFiles,
  hashShellInputFiles,
  isDevVendorEnabled,
  isDevVendorRequest,
  inspectDevVendorGraph,
  loadRuntime,
  refreshRuntimeCacheForChanges,
  resetRuntimeCacheForTests,
  sha256,
  shouldPrependCommon,
  verifyManifest,
};
