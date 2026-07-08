const fs = require('fs');
const path = require('path');

const { createResolveExtensions } = require('../../webpack/utils');

function createWebExtensions() {
  const originalLog = console.log;
  try {
    console.log = () => {};
    return createResolveExtensions({ platform: 'web' });
  } finally {
    console.log = originalLog;
  }
}

const WEB_EXTENSIONS = createWebExtensions();

const WORKSPACE_PACKAGES = [
  ['@onekeyhq/shared', 'packages/shared'],
  ['@onekeyhq/components', 'packages/components'],
  ['@onekeyhq/core', 'packages/core'],
  ['@onekeyhq/kit-bg', 'packages/kit-bg'],
  ['@onekeyhq/kit', 'packages/kit'],
  ['@onekeyhq/qr-wallet-sdk', 'packages/qr-wallet-sdk'],
];

function toPosixPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function normalizeSourcePath({ repoRoot, source }) {
  let value = toPosixPath(source)
    .split('?')[0]
    .replace(/^webpack:\/\/[^/]+\//, '')
    .replace(/^webpack:\/\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '');

  if (path.isAbsolute(value)) {
    value = path.relative(repoRoot, value);
  }
  const repoPath = toPosixPath(value);
  if (fs.existsSync(path.join(repoRoot, repoPath))) {
    return repoPath;
  }
  const webPath = toPosixPath(path.join('apps', 'web', repoPath));
  if (fs.existsSync(path.join(repoRoot, webPath))) {
    return webPath;
  }
  return repoPath;
}

function packageNameFromSpecifier(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/')) {
    return null;
  }
  const parts = specifier.split('/');
  if (parts[0]?.startsWith('@')) return parts.slice(0, 2).join('/');
  return parts[0] || null;
}

function packageNameFromNodeModule(source) {
  const marker = 'node_modules/';
  const index = source.indexOf(marker);
  if (index < 0) return null;
  return packageNameFromSpecifier(source.slice(index + marker.length));
}

function isTypeOnlyClause(clause) {
  const value = String(clause || '').trim();
  if (value.startsWith('type ')) return true;
  if (!value.startsWith('{') || !value.endsWith('}')) return false;

  const specifiers = value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    specifiers.length > 0 &&
    specifiers.every((specifier) => specifier.startsWith('type '))
  );
}

function parseImports(sourceText) {
  const imports = [];

  const importFromRegex = /\bimport\s+([^'";]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match = importFromRegex.exec(sourceText);
  while (match) {
    if (!isTypeOnlyClause(match[1])) {
      imports.push({ specifier: match[2], edgeType: 'sync' });
    }
    match = importFromRegex.exec(sourceText);
  }

  const sideEffectImportRegex = /\bimport\s+['"]([^'"]+)['"]/g;
  match = sideEffectImportRegex.exec(sourceText);
  while (match) {
    imports.push({ specifier: match[1], edgeType: 'sync' });
    match = sideEffectImportRegex.exec(sourceText);
  }

  const exportFromRegex = /\bexport\s+([^'";]*?)\s+from\s+['"]([^'"]+)['"]/g;
  match = exportFromRegex.exec(sourceText);
  while (match) {
    if (!isTypeOnlyClause(match[1])) {
      imports.push({ specifier: match[2], edgeType: 'sync' });
    }
    match = exportFromRegex.exec(sourceText);
  }

  const requireRegex = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  match = requireRegex.exec(sourceText);
  while (match) {
    imports.push({ specifier: match[1], edgeType: 'sync' });
    match = requireRegex.exec(sourceText);
  }

  const dynamicImportRegex = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  match = dynamicImportRegex.exec(sourceText);
  while (match) {
    imports.push({ specifier: match[1], edgeType: 'dynamic' });
    match = dynamicImportRegex.exec(sourceText);
  }
  return imports;
}

function buildPackageCandidateMap(candidateSet) {
  const map = new Map();
  for (const candidate of candidateSet) {
    const packageName = packageNameFromNodeModule(candidate);
    if (packageName) {
      if (!map.has(packageName)) map.set(packageName, []);
      map.get(packageName).push(candidate);
    }
  }

  for (const candidates of map.values()) {
    candidates.sort((a, b) => {
      const indexDelta =
        Number(!/\/index\.[cm]?[jt]sx?$/.test(a)) -
        Number(!/\/index\.[cm]?[jt]sx?$/.test(b));
      return indexDelta || a.length - b.length || a.localeCompare(b);
    });
  }
  return map;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizePackageTarget(packagePath, target) {
  if (
    !target ||
    typeof target !== 'string' ||
    target.startsWith('/') ||
    /^[a-z][a-z+.-]*:/i.test(target)
  ) {
    return null;
  }
  const relativeTarget = target.startsWith('.') ? target : `./${target}`;
  return toPosixPath(path.posix.join(packagePath, relativeTarget));
}

function collectExportTargets(value, targets = []) {
  if (!value) return targets;
  if (typeof value === 'string') {
    targets.push(value);
    return targets;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectExportTargets(item, targets);
    return targets;
  }
  if (typeof value !== 'object') return targets;

  const preferredKeys = [
    'browser',
    'react-native',
    'import',
    'module',
    'default',
    'require',
  ];
  const keys = [
    ...preferredKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    ),
    ...Object.keys(value)
      .filter((key) => !preferredKeys.includes(key))
      .toSorted(),
  ];
  for (const key of keys) {
    collectExportTargets(value[key], targets);
  }
  return targets;
}

function getExportsValueForSubpath(exportsValue, subpath) {
  if (!exportsValue) return null;
  if (!subpath) {
    if (typeof exportsValue === 'string' || Array.isArray(exportsValue)) {
      return exportsValue;
    }
    if (typeof exportsValue === 'object') {
      if (Object.prototype.hasOwnProperty.call(exportsValue, '.')) {
        return exportsValue['.'];
      }
      const keys = Object.keys(exportsValue);
      if (keys.every((key) => !key.startsWith('.'))) return exportsValue;
    }
    return null;
  }

  if (typeof exportsValue !== 'object' || Array.isArray(exportsValue)) {
    return null;
  }

  const exportKey = `./${subpath}`;
  if (Object.prototype.hasOwnProperty.call(exportsValue, exportKey)) {
    return exportsValue[exportKey];
  }

  for (const [key, value] of Object.entries(exportsValue).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const starIndex = key.indexOf('*');
    if (starIndex >= 0) {
      const prefix = key.slice(0, starIndex);
      const suffix = key.slice(starIndex + 1);
      if (exportKey.startsWith(prefix) && exportKey.endsWith(suffix)) {
        const wildcard = exportKey.slice(
          prefix.length,
          exportKey.length - suffix.length,
        );
        return collectExportTargets(value)
          .filter((target) => target.includes('*'))
          .map((target) => target.split('*').join(wildcard));
      }
    }
  }
  return null;
}

function getPackageEntryCandidates({ repoRoot, packagePath, subpath = '' }) {
  const packageJsonPath = path.join(repoRoot, packagePath, 'package.json');
  const packageJson = readJsonFile(packageJsonPath);
  const candidates = [];

  if (subpath) {
    candidates.push(path.posix.join(packagePath, subpath));
  }

  if (packageJson?.exports) {
    for (const target of collectExportTargets(
      getExportsValueForSubpath(packageJson.exports, subpath),
    )) {
      const normalized = normalizePackageTarget(packagePath, target);
      if (normalized) candidates.push(normalized);
    }
  }

  if (!subpath && packageJson) {
    for (const field of ['browser', 'module', 'main']) {
      if (typeof packageJson[field] === 'string') {
        const normalized = normalizePackageTarget(
          packagePath,
          packageJson[field],
        );
        if (normalized) candidates.push(normalized);
      }
    }
  }

  candidates.push(packagePath);
  return [...new Set(candidates)];
}

function tryResolveCandidate(basePath, candidateSet, extensions) {
  const normalized = toPosixPath(path.posix.normalize(basePath));
  const attempts = [normalized];
  for (const extension of extensions) {
    attempts.push(`${normalized}${extension}`);
  }
  for (const extension of extensions) {
    attempts.push(path.posix.join(normalized, `index${extension}`));
  }
  return attempts.find((item) => candidateSet.has(item)) || null;
}

function workspaceSpecifierToPackage(specifier) {
  for (const [packageName, packagePath] of WORKSPACE_PACKAGES) {
    if (specifier === packageName) return { packageName, packagePath };
    if (specifier.startsWith(`${packageName}/`)) {
      return {
        packageName,
        packagePath,
        subpath: specifier.slice(packageName.length + 1),
      };
    }
  }
  return null;
}

function nodeModuleSpecifierToPackage(specifier) {
  const packageName = packageNameFromSpecifier(specifier);
  if (!packageName) return null;
  const subpath =
    specifier === packageName ? '' : specifier.slice(packageName.length + 1);
  return {
    packageName,
    packagePath: path.posix.join('node_modules', packageName),
    subpath,
  };
}

function createWebResolveAliases(repoRoot) {
  return [
    ['react-native$', 'react-native-web'],
    [
      'react-native-fast-image',
      path.join(
        repoRoot,
        'development/module-resolver/react-native-fast-image-mock',
      ),
    ],
    [
      'react-native-keyboard-controller',
      path.join(
        repoRoot,
        'development/module-resolver/react-native-keyboard-controller-mock',
      ),
    ],
    ['react-native-aes-crypto', false],
    ['react-native-cloud-fs', false],
    [
      'react-native/Libraries/Components/View/ViewStylePropTypes$',
      'react-native-web/dist/exports/View/ViewStylePropTypes',
    ],
    [
      'react-native/Libraries/EventEmitter/RCTDeviceEventEmitter$',
      'react-native-web/dist/vendor/react-native/NativeEventEmitter/RCTDeviceEventEmitter',
    ],
    [
      'react-native/Libraries/vendor/emitter/EventEmitter$',
      'react-native-web/dist/vendor/react-native/emitter/EventEmitter',
    ],
    [
      'react-native/Libraries/vendor/emitter/EventSubscriptionVendor$',
      'react-native-web/dist/vendor/react-native/emitter/EventSubscriptionVendor',
    ],
    [
      'react-native/Libraries/EventEmitter/NativeEventEmitter$',
      'react-native-web/dist/vendor/react-native/NativeEventEmitter',
    ],
    [
      '@react-aria/focus',
      path.join(repoRoot, 'node_modules/@react-aria/focus/src/index.ts'),
    ],
    [
      '@react-aria/interactions',
      path.join(repoRoot, 'node_modules/@react-aria/interactions/src/index.ts'),
    ],
    [
      '@react-aria/ssr',
      path.join(repoRoot, 'node_modules/@react-aria/ssr/src/index.ts'),
    ],
    [
      '@react-aria/utils',
      path.join(repoRoot, 'node_modules/@react-aria/utils/src/index.ts'),
    ],
    ['bn.js$', require.resolve('bn.js')],
  ].map(([request, replacement]) => ({
    request: request.endsWith('$') ? request.slice(0, -1) : request,
    exact: request.endsWith('$'),
    replacement,
  }));
}

function applyResolveAlias({ repoRoot, specifier, aliases }) {
  for (const alias of aliases) {
    const isMatch = alias.exact
      ? specifier === alias.request
      : specifier === alias.request ||
        specifier.startsWith(`${alias.request}/`);
    if (isMatch) {
      if (alias.replacement === false) return { ignored: true };

      const suffix = alias.exact ? '' : specifier.slice(alias.request.length);
      const target = `${alias.replacement}${suffix}`;
      return {
        specifier: path.isAbsolute(target)
          ? toPosixPath(path.relative(repoRoot, target))
          : toPosixPath(target),
      };
    }
  }
  return null;
}

function resolveCandidatePaths({ paths, candidateSet, extensions }) {
  for (const item of paths) {
    const resolved = tryResolveCandidate(item, candidateSet, extensions);
    if (resolved) return resolved;
  }
  return null;
}

function resolveSpecifier({
  repoRoot,
  from,
  specifier,
  candidateSet,
  packageCandidateMap,
  extensions,
  aliases,
}) {
  if (!specifier) return null;

  if (specifier.startsWith('.')) {
    return tryResolveCandidate(
      path.posix.join(path.posix.dirname(from), specifier),
      candidateSet,
      extensions,
    );
  }

  const aliasTarget = applyResolveAlias({ repoRoot, specifier, aliases });
  if (aliasTarget?.ignored) return null;
  if (aliasTarget?.specifier) {
    const aliasSpecifier = aliasTarget.specifier;
    if (aliasSpecifier.startsWith('.')) {
      return tryResolveCandidate(
        path.posix.join(path.posix.dirname(from), aliasSpecifier),
        candidateSet,
        extensions,
      );
    }
    const normalizedAliasPath = toPosixPath(
      path.posix.normalize(aliasSpecifier),
    );
    const aliasPathResolved = tryResolveCandidate(
      normalizedAliasPath,
      candidateSet,
      extensions,
    );
    if (aliasPathResolved) return aliasPathResolved;

    const aliasedWorkspacePackage = workspaceSpecifierToPackage(aliasSpecifier);
    if (aliasedWorkspacePackage) {
      return resolveCandidatePaths({
        paths: getPackageEntryCandidates({
          repoRoot,
          ...aliasedWorkspacePackage,
        }),
        candidateSet,
        extensions,
      });
    }

    const aliasedNodeModulePackage =
      nodeModuleSpecifierToPackage(aliasSpecifier);
    if (aliasedNodeModulePackage) {
      const resolved = resolveCandidatePaths({
        paths: getPackageEntryCandidates({
          repoRoot,
          ...aliasedNodeModulePackage,
        }),
        candidateSet,
        extensions,
      });
      if (resolved) return resolved;
    }
  }

  const workspacePackage = workspaceSpecifierToPackage(specifier);
  if (workspacePackage) {
    return resolveCandidatePaths({
      paths: getPackageEntryCandidates({ repoRoot, ...workspacePackage }),
      candidateSet,
      extensions,
    });
  }

  const nodeModulePackage = nodeModuleSpecifierToPackage(specifier);
  if (nodeModulePackage) {
    const resolved = resolveCandidatePaths({
      paths: getPackageEntryCandidates({ repoRoot, ...nodeModulePackage }),
      candidateSet,
      extensions,
    });
    if (resolved) return resolved;
  }

  const packageName = packageNameFromSpecifier(specifier);
  return packageName ? packageCandidateMap.get(packageName)?.[0] || null : null;
}

function buildStaticImportGraph({ repoRoot, modules, extensions }) {
  const candidateSet = new Set(
    modules.map((source) => normalizeSourcePath({ repoRoot, source })),
  );
  const packageCandidateMap = buildPackageCandidateMap(candidateSet);
  const aliases = createWebResolveAliases(repoRoot);
  const graph = new Map();

  for (const source of candidateSet) {
    const filePath = path.join(repoRoot, source);
    if (!fs.existsSync(filePath)) {
      graph.set(source, []);
    } else {
      let sourceText = '';
      try {
        sourceText = fs.readFileSync(filePath, 'utf8');
      } catch {
        graph.set(source, []);
      }

      const edges = [];
      if (sourceText) {
        for (const item of parseImports(sourceText)) {
          const resolved = resolveSpecifier({
            repoRoot,
            from: source,
            specifier: item.specifier,
            candidateSet,
            packageCandidateMap,
            extensions,
            aliases,
          });
          if (resolved) {
            edges.push({
              to: resolved,
              specifier: item.specifier,
              edgeType: item.edgeType,
            });
          }
        }
      }
      graph.set(source, edges);
    }
  }

  return { graph, candidateSet };
}

function reconstructChain({ parent, target }) {
  const edges = [];
  let current = target;
  while (parent.has(current)) {
    const edge = parent.get(current);
    edges.push(edge);
    current = edge.from;
  }
  return edges.toReversed();
}

function findShortestChain({ graph, roots, target, maxDepth = 24 }) {
  const queue = roots.map((root) => ({ node: root, depth: 0 }));
  const visited = new Set(roots);
  const parent = new Map();

  while (queue.length) {
    const item = queue.shift();
    if (item.node === target) {
      return reconstructChain({ parent, target });
    }
    if (item.depth < maxDepth) {
      for (const edge of graph.get(item.node) || []) {
        if (edge.edgeType === 'sync' && !visited.has(edge.to)) {
          visited.add(edge.to);
          parent.set(edge.to, { from: item.node, ...edge });
          queue.push({ node: edge.to, depth: item.depth + 1 });
        }
      }
    }
  }
  return null;
}

function createStaticImportChainReport({
  repoRoot,
  modules,
  roots,
  targets,
  platform = 'web',
  maxChains = 20,
  maxDepth = 24,
  extensions = WEB_EXTENSIONS,
}) {
  const { graph, candidateSet } = buildStaticImportGraph({
    repoRoot,
    modules,
    extensions,
  });
  const normalizedRoots = roots
    .map((source) => normalizeSourcePath({ repoRoot, source }))
    .filter((source) => candidateSet.has(source));
  const normalizedTargets = [
    ...new Set(
      targets
        .map((source) => normalizeSourcePath({ repoRoot, source }))
        .filter((source) => candidateSet.has(source)),
    ),
  ].slice(0, maxChains);

  const chains = normalizedTargets.map((target) => {
    const chain = findShortestChain({
      graph,
      roots: normalizedRoots,
      target,
      maxDepth,
    });
    return {
      target,
      status: chain ? 'found' : 'unreachable',
      chain:
        chain?.map((edge) => ({
          from: edge.from,
          to: edge.to,
          specifier: edge.specifier,
          edgeType: edge.edgeType,
        })) || [],
    };
  });

  return {
    kind: 'static-import-chain',
    platform,
    graphNodeCount: candidateSet.size,
    graphEdgeCount: [...graph.values()].reduce(
      (count, edges) => count + edges.length,
      0,
    ),
    roots: normalizedRoots,
    targetCount: normalizedTargets.length,
    chains,
  };
}

module.exports = {
  createStaticImportChainReport,
};
