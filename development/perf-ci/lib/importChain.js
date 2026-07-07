const fs = require('fs');
const path = require('path');

const WEB_EXTENSIONS = [
  '.web.tsx',
  '.web.ts',
  '.tsx',
  '.ts',
  '.web.jsx',
  '.web.js',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
];

const WORKSPACE_PACKAGES = [
  ['@onekeyhq/shared', 'packages/shared'],
  ['@onekeyhq/components', 'packages/components'],
  ['@onekeyhq/core', 'packages/core'],
  ['@onekeyhq/kit-bg', 'packages/kit-bg'],
  ['@onekeyhq/kit', 'packages/kit'],
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

function parseImports(sourceText) {
  const imports = [];
  const patterns = [
    {
      type: 'sync',
      regex: /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    },
    {
      type: 'sync',
      regex: /\bexport\s+(?:type\s+)?[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    },
    {
      type: 'sync',
      regex: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
    {
      type: 'dynamic',
      regex: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
  ];

  for (const pattern of patterns) {
    let match = pattern.regex.exec(sourceText);
    while (match) {
      imports.push({ specifier: match[1], edgeType: pattern.type });
      match = pattern.regex.exec(sourceText);
    }
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

function workspaceSpecifierToPath(specifier) {
  for (const [packageName, packagePath] of WORKSPACE_PACKAGES) {
    if (specifier === packageName) return packagePath;
    if (specifier.startsWith(`${packageName}/`)) {
      return path.posix.join(packagePath, specifier.slice(packageName.length));
    }
  }
  return null;
}

function resolveSpecifier({
  from,
  specifier,
  candidateSet,
  packageCandidateMap,
  extensions,
}) {
  if (!specifier) return null;

  if (specifier.startsWith('.')) {
    return tryResolveCandidate(
      path.posix.join(path.posix.dirname(from), specifier),
      candidateSet,
      extensions,
    );
  }

  const workspacePath = workspaceSpecifierToPath(specifier);
  if (workspacePath) {
    return tryResolveCandidate(workspacePath, candidateSet, extensions);
  }

  const packageName = packageNameFromSpecifier(specifier);
  return packageName ? packageCandidateMap.get(packageName)?.[0] || null : null;
}

function buildStaticImportGraph({ repoRoot, modules, extensions }) {
  const candidateSet = new Set(
    modules.map((source) => normalizeSourcePath({ repoRoot, source })),
  );
  const packageCandidateMap = buildPackageCandidateMap(candidateSet);
  const graph = new Map();

  for (const source of candidateSet) {
    const filePath = path.join(repoRoot, source);
    if (!fs.existsSync(filePath) || source.includes('node_modules/')) {
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
            from: source,
            specifier: item.specifier,
            candidateSet,
            packageCandidateMap,
            extensions,
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
        if (!visited.has(edge.to)) {
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
