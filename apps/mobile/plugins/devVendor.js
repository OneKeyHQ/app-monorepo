/* cspell:words codegen Codegen Srcs */
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
const NATIVE_ABI_SOURCE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.m',
  '.mm',
  '.swift',
  '.ts',
  '.tsx',
]);
const NATIVE_ABI_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '__tests__',
  'build',
  'dist',
  'docs',
  'example',
  'examples',
  'generated',
  'lib',
  'node_modules',
  'prebuilds',
  'test',
  'tests',
  'vendor',
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

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => compareStrings(left, right))
      .map(([key, child]) => [key, stableJsonValue(child)]),
  );
}

function stableJsonStringify(value) {
  return JSON.stringify(stableJsonValue(value));
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

function assertIosNativeDependenciesLinked(dependencyNames, repoRoot) {
  const sections = getCocoaPodsLockSections(
    fs.readFileSync(
      path.join(repoRoot, 'apps/mobile/ios/Podfile.lock'),
      'utf8',
    ),
  );
  const dependencyLines = sections.get('DEPENDENCIES');
  if (!dependencyLines) {
    throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
  }
  const dependencyNameSet = new Set(dependencyNames);
  const linkedPackages = new Set();
  for (const line of dependencyLines) {
    if (!line.startsWith('  - ')) {
      throw new Error('[devVendor] Invalid CocoaPods lock resolution.');
    }
    const dependency = readCocoaPodsLockScalar(line.slice(4));
    const packageMatch = dependency.match(
      /node_modules\/((?:@[^/`]+\/)?[^/`]+)/u,
    );
    if (packageMatch && dependencyNameSet.has(packageMatch[1])) {
      linkedPackages.add(packageMatch[1]);
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
}

function getInstalledPackageRoot(packageName, repoRoot) {
  try {
    return path.dirname(
      require.resolve(`${packageName}/package.json`, {
        paths: [path.join(repoRoot, 'apps/mobile'), repoRoot],
      }),
    );
  } catch (error) {
    throw new Error(
      `[devVendor] Install dependencies before resolving the native ABI: ${packageName}`,
      { cause: error },
    );
  }
}

function listAbsoluteFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const pending = [directory];
  const files = [];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const excludedDirectory =
        entry.isDirectory() &&
        NATIVE_ABI_EXCLUDED_DIRECTORIES.has(entry.name) &&
        (!['build', 'dist', 'lib'].includes(entry.name) ||
          current === directory);
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory() && !excludedDirectory) {
        pending.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }
  return files.toSorted(compareStrings);
}

function isFileForPlatform(filePath, platform) {
  const normalized = filePath.split(path.sep).join('/').toLowerCase();
  if (platform === 'android') {
    return !/(?:^|\/)(?:apple|ios)(?:\/|$)|\.ios\.[^/]+$/u.test(normalized);
  }
  return !/(?:^|\/)android(?:\/|$)|\.android\.[^/]+$/u.test(normalized);
}

function getPackageSourceFiles(packageRoot, platform) {
  const sourceRoots = ['android/src', 'apple', 'binding', 'ios', 'js', 'src']
    .map((relativePath) => path.join(packageRoot, relativePath))
    .filter((absolutePath) => fs.existsSync(absolutePath));
  const rootFiles = fs
    .readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(packageRoot, entry.name));
  return [...new Set([...rootFiles, ...sourceRoots.flatMap(listAbsoluteFiles)])]
    .filter(
      (filePath) =>
        NATIVE_ABI_SOURCE_EXTENSIONS.has(
          path.extname(filePath).toLowerCase(),
        ) && isFileForPlatform(filePath, platform),
    )
    .toSorted(compareStrings);
}

function getCodegenConfigurations(packageJson) {
  if (!packageJson.codegenConfig) return [];
  return packageJson.codegenConfig.libraries || [packageJson.codegenConfig];
}

function getCodegenAbiDescriptor({ packageJson, packageRoot, platform }) {
  const {
    combineSchemas,
  } = require('@react-native/codegen/lib/cli/combine/combine-js-to-schema.js');
  const {
    filterJSFile,
  } = require('@react-native/codegen/lib/cli/combine/combine-utils.js');
  return getCodegenConfigurations(packageJson).map((config) => {
    const sourceRoot = path.resolve(packageRoot, config.jsSrcsDir || '.');
    if (!fs.existsSync(sourceRoot)) {
      throw new Error(
        `[devVendor] Native codegen source directory is missing: ${packageJson.name}/${config.jsSrcsDir}`,
      );
    }
    const sourceFiles = listAbsoluteFiles(sourceRoot).filter((filePath) => {
      if (!/\.(?:js|ts|tsx)$/u.test(filePath)) return false;
      if (!filterJSFile(filePath, platform, null)) return false;
      const source = fs.readFileSync(filePath, 'utf8');
      return (
        /\bextends\s+TurboModule\b/u.test(source) ||
        /\bcodegenNativeComponent\s*</u.test(source)
      );
    });
    const schema = combineSchemas(sourceFiles, config.name);
    return {
      name: config.name,
      schemaDigest: sha256(stableJsonStringify(schema)),
      type: config.type,
    };
  });
}

function canonicalAstDigest(filePath) {
  const parser = require('@babel/parser');
  const source = fs.readFileSync(filePath, 'utf8');
  const commonPlugins = [
    'classProperties',
    'decorators-legacy',
    'dynamicImport',
    'importMeta',
    'jsx',
    'topLevelAwait',
  ];
  let ast;
  try {
    ast = parser.parse(source, {
      plugins: [...commonPlugins, 'typescript'],
      sourceType: 'unambiguous',
    });
  } catch {
    ast = parser.parse(source, {
      plugins: [...commonPlugins, 'flow', 'flowComments'],
      sourceType: 'unambiguous',
    });
  }
  const stripMetadata = (value) => {
    if (Array.isArray(value)) return value.map(stripMetadata);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              'comments',
              'end',
              'errors',
              'extra',
              'leadingComments',
              'loc',
              'start',
              'tokens',
              'trailingComments',
            ].includes(key),
        )
        .map(([key, child]) => [key, stripMetadata(child)]),
    );
  };
  return sha256(stableJsonStringify(stripMetadata(ast.program)));
}

function extractMacroBodies(source, macroName) {
  const bodies = [];
  const marker = `${macroName}(`;
  let offset = 0;
  while ((offset = source.indexOf(marker, offset)) >= 0) {
    let depth = 1;
    let cursor = offset + marker.length;
    let quote;
    for (; cursor < source.length && depth > 0; cursor += 1) {
      const character = source[cursor];
      if (quote) {
        if (character === '\\') cursor += 1;
        else if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
      }
    }
    if (depth === 0) {
      bodies.push(source.slice(offset + marker.length, cursor - 1));
      offset = cursor;
    } else {
      break;
    }
  }
  return bodies;
}

function countBridgeArguments(signature) {
  return (signature.match(/:/gu) || []).length;
}

function extractNativeBridgeSymbols(source) {
  const symbols = new Set();
  const addMatches = (label, pattern) => {
    for (const match of source.matchAll(pattern)) {
      const name = match.slice(1).find(Boolean);
      if (name) symbols.add(`${label}:${name}`);
    }
  };
  addMatches(
    'js-module',
    /\bNativeModules(?:\.([A-Za-z_$][\w$]*)|\[['"]([^'"]+)['"]\])/gu,
  );
  addMatches(
    'js-native',
    /\b(?:createHybridObject|getHybridObjectConstructor|requireNativeComponent|requireNativeModule|requireNativeViewManager)\s*(?:<[^;()]*>)?\s*\(\s*['"]([^'"]+)['"]/gu,
  );
  addMatches(
    'jsi-property',
    /\b(?:PropNameID::forAscii|setProperty)\s*\([^,]+,\s*['"]([^'"]+)['"]/gu,
  );
  addMatches(
    'android-module',
    /\bgetName\s*\(\s*\)\s*(?:const\s*)?(?:override\s*)?(?:final\s*)?(?:->\s*[^{]+)?\{[\s\S]{0,300}?\breturn\s+['"]([^'"]+)['"]/gu,
  );
  addMatches(
    'android-module',
    /\b(?:const\s+val|static\s+final\s+String)\s+NAME\s*=\s*['"]([^'"]+)['"]/gu,
  );
  addMatches('expo-module', /\bName\s*\(\s*['"]([^'"]+)['"]\s*\)/gu);
  addMatches(
    'expo-member',
    /\b(?:AsyncFunction|Events|Function|Prop|Property)\s*\(\s*['"]([^'"]+)['"]/gu,
  );
  for (const macroName of ['RCT_EXPORT_MODULE', 'RCT_EXTERN_MODULE']) {
    for (const body of extractMacroBodies(source, macroName)) {
      const name = body.trim().split(/[\s,]/u, 1)[0];
      if (name) symbols.add(`ios-module:${name}`);
    }
  }
  for (const macroName of [
    'RCT_EXPORT_METHOD',
    'RCT_EXTERN_METHOD',
    'RCT_REMAP_METHOD',
  ]) {
    for (const body of extractMacroBodies(source, macroName)) {
      const name = body.trim().match(/^([A-Za-z_$][\w$]*)/u)?.[1];
      if (name) {
        symbols.add(`ios-method:${name}/${String(countBridgeArguments(body))}`);
      }
    }
  }
  for (const match of source.matchAll(
    /@ReactMethod(?:\([^)]*\))?[\s\S]{0,300}?\b(?:fun|void|boolean|double|float|int|long|String|WritableMap|WritableArray|Promise)\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gu,
  )) {
    const argumentCount = match[2].trim() ? match[2].split(',').length : 0;
    symbols.add(`android-method:${match[1]}/${String(argumentCount)}`);
  }
  return [...symbols].toSorted(compareStrings);
}

function getExpoModuleTopology(packageRoot, platform) {
  const configPath = path.join(packageRoot, 'expo-module.config.json');
  if (!fs.existsSync(configPath)) return null;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const platformKeys = platform === 'ios' ? ['apple', 'ios'] : ['android'];
  const selectTopology = (value = {}) =>
    Object.fromEntries(
      [
        'appDelegateSubscribers',
        'gradlePlugins',
        'modules',
        'reactDelegateHandlers',
        'services',
      ]
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, value[key]]),
    );
  return Object.fromEntries(
    platformKeys
      .filter((key) => config[key])
      .map((key) => [key, selectTopology(config[key])]),
  );
}

function getNativePackageAbiInputs(packageName, platform, repoRoot) {
  const packageRoot = getInstalledPackageRoot(packageName, repoRoot);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const sourceFiles = getPackageSourceFiles(packageRoot, platform);
  const nitroConfigPath = path.join(packageRoot, 'nitro.json');
  const nitroSpecFiles = sourceFiles.filter((filePath) =>
    /\.nitro\.(?:ts|tsx)$/u.test(filePath),
  );
  const markerPattern =
    /NativeModules|TurboModule|codegenNative|createHybridObject|requireNative|RCT_(?:EXPORT|EXTERN|REMAP)|@ReactMethod|ModuleDefinition|PropNameID::forAscii|\.setProperty\s*\(/u;
  const bridgeFiles = sourceFiles.filter((filePath) => {
    const stat = fs.statSync(filePath);
    return (
      stat.size <= 8 * 1024 * 1024 &&
      markerPattern.test(fs.readFileSync(filePath, 'utf8'))
    );
  });
  return {
    bridgeFiles,
    expoConfigPath: fs.existsSync(
      path.join(packageRoot, 'expo-module.config.json'),
    )
      ? path.join(packageRoot, 'expo-module.config.json')
      : undefined,
    nitroConfigPath: fs.existsSync(nitroConfigPath)
      ? nitroConfigPath
      : undefined,
    nitroSpecFiles,
    packageJson,
    packageJsonPath,
    packageRoot,
  };
}

function getNativePackageAbiInputPaths(
  packageName,
  platform,
  repoRoot = REPO_ROOT,
) {
  const inputs = getNativePackageAbiInputs(packageName, platform, repoRoot);
  const hermesCompilerPath =
    packageName === 'hermes-compiler'
      ? getHermesCompilerExecutable(inputs.packageRoot)
      : undefined;
  return [
    inputs.packageJsonPath,
    inputs.expoConfigPath,
    hermesCompilerPath,
    inputs.nitroConfigPath,
    ...inputs.nitroSpecFiles,
    ...inputs.bridgeFiles,
  ]
    .filter(Boolean)
    .map((absolutePath) =>
      path.relative(repoRoot, absolutePath).split(path.sep).join('/'),
    )
    .toSorted(compareStrings);
}

function getNativePackageAbiDescriptor(packageName, platform, repoRoot) {
  const inputs = getNativePackageAbiInputs(packageName, platform, repoRoot);
  const nitroConfig = inputs.nitroConfigPath
    ? JSON.parse(fs.readFileSync(inputs.nitroConfigPath, 'utf8'))
    : undefined;
  const nitroTopology = nitroConfig
    ? {
        autolinking: nitroConfig.autolinking,
        cxxNamespace: nitroConfig.cxxNamespace,
        platform: nitroConfig[platform],
      }
    : null;
  return {
    bridgeSymbols: [
      ...new Set(
        inputs.bridgeFiles.flatMap((filePath) =>
          extractNativeBridgeSymbols(fs.readFileSync(filePath, 'utf8')),
        ),
      ),
    ].toSorted(compareStrings),
    codegen: getCodegenAbiDescriptor({
      packageJson: inputs.packageJson,
      packageRoot: inputs.packageRoot,
      platform,
    }),
    expo: getExpoModuleTopology(inputs.packageRoot, platform),
    name: packageName,
    nitro: nitroTopology,
    nitroSpecDigests: inputs.nitroSpecFiles
      .map(canonicalAstDigest)
      .toSorted(compareStrings),
  };
}

function getHermesCompilerExecutable(packageRoot) {
  let platformDirectory = 'linux64-bin';
  if (process.platform === 'win32') platformDirectory = 'win64-bin';
  if (process.platform === 'darwin') platformDirectory = 'osx-bin';
  return path.join(
    packageRoot,
    'hermesc',
    platformDirectory,
    process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
  );
}

function getHermesBytecodeVersion(repoRoot) {
  const packageRoot = getInstalledPackageRoot('hermes-compiler', repoRoot);
  const executable = getHermesCompilerExecutable(packageRoot);
  const result = spawnSync(executable, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/HBC bytecode version:\s*(\d+)/u);
  if (result.status !== 0 || result.error || !match) {
    throw new Error(
      `[devVendor] Unable to read the Hermes bytecode ABI: ${result.stderr || result.error?.message || 'unknown error'}`,
    );
  }
  return Number(match[1]);
}

function getAppNativeAbiDescriptor(platform, repoRoot) {
  const sourceExtensions = NATIVE_CONTRACT_SOURCE_EXTENSIONS[platform];
  const files = getAppNativeContractInputPaths(platform, repoRoot).filter(
    (relativePath) =>
      sourceExtensions.has(path.extname(relativePath).toLowerCase()),
  );
  return {
    bridgeSymbols: [
      ...new Set(
        files.flatMap((relativePath) =>
          extractNativeBridgeSymbols(
            fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'),
          ),
        ),
      ),
    ].toSorted(compareStrings),
  };
}

function getNativeContractDescriptor(platform, repoRoot = REPO_ROOT) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  const dependencyNames = [
    ...devVendorConfig.nativeContractDependencies.shared,
    ...devVendorConfig.nativeContractDependencies[platform],
  ].toSorted();
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
  if (platform === 'ios') {
    assertIosNativeDependenciesLinked(dependencyNames, repoRoot);
  }
  return {
    app: getAppNativeAbiDescriptor(platform, repoRoot),
    dependencies: dependencyNames.map((name) =>
      getNativePackageAbiDescriptor(name, platform, repoRoot),
    ),
    engine,
    hermesBytecodeVersion: getHermesBytecodeVersion(repoRoot),
    loaderProtocolVersion: devVendorConfig.NATIVE_LOADER_PROTOCOL_VERSION,
    platform,
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
      `engine.hermes=${descriptor.engine.hermes}`,
      `engine.new-architecture=${descriptor.engine.newArchitecture}`,
      `hermes-bytecode-version=${String(descriptor.hermesBytecodeVersion)}`,
      `app=${stableJsonStringify(descriptor.app)}`,
      ...descriptor.dependencies.map(stableJsonStringify),
    ].join('\0'),
  );
}

function computeShellCompatibilityKey({ nativeContractKey, platform }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`[devVendor] Unsupported native platform: ${platform}`);
  }
  if (!/^[0-9a-f]{64}$/u.test(nativeContractKey || '')) {
    throw new Error('[devVendor] Invalid native contract key.');
  }
  const architecture = platform === 'android' ? 'arm64-v8a' : 'arm64';
  return sha256(
    [
      'onekey-mobile-dev-shell-compatibility-v3',
      `platform=${platform}`,
      `architecture=${architecture}`,
      `native-contract=${nativeContractKey}`,
      '',
    ].join('\0'),
  );
}

function computeShellInputKey({ nativeContractKey, platform }) {
  const shellCompatibilityKey = computeShellCompatibilityKey({
    nativeContractKey,
    platform,
  });
  return sha256(
    [
      'onekey-mobile-dev-shell-input-v3',
      `compatibility=${shellCompatibilityKey}`,
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
  if (
    typeof requestedSessionId !== 'string' ||
    !DEV_SESSION_ID_PATTERN.test(requestedSessionId)
  ) {
    throw new Error(
      `[devVendor] Native ${platform} request has an invalid dev session ID.`,
    );
  }
  const serverSessionId = env.ONEKEY_DEV_SESSION_ID;
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
  getNativePackageAbiInputPaths,
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
