/**
 * Segment serializer (Phase 2)
 *
 * Extends the existing dynamicImports plugin to support:
 * 1. Named segments (seg:feature.xxx) instead of hash-based chunks
 * 2. Stable segmentId allocation (sorted by segmentKey)
 * 3. Segment manifest output (JSON embedded in eager entry)
 * 4. Production-ready segment JS files (not dev URL based)
 *
 * This serializer is used when SPLIT_BUNDLE_SEGMENTS=true.
 * It replaces the old hash-chunk system with named, typed segments.
 */

const crypto = require('crypto');
const path = require('path');

const fs = require('fs-extra');

const { fileToIdMap } = require('./map');
const { SEGMENTS_INPUT_DIR, SEGMENT_MANIFEST_PATH } = require('./segmentPaths');

const baseJSBundle = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/DeltaBundler/Serializers/baseJSBundle',
  ),
);
const bundleToString = require(
  path.resolve(
    __dirname,
    '../../../node_modules',
    'metro/src/lib/bundleToString',
  ),
);

// ---------------------------------------------------------------------------
// Segment naming: derive a readable segment key from the async module path
// ---------------------------------------------------------------------------

const monorepoRoot = path.resolve(__dirname, '../../..');

function deriveSegmentKey(absolutePath) {
  const rel = absolutePath
    .replace(monorepoRoot, '')
    .replace(/^\//, '')
    .replace(/\.(ts|tsx|js|jsx)$/, '');

  // packages/kit-bg/src/services/ServiceSwap → seg:kit-bg.services.ServiceSwap
  // packages/kit/src/views/Discovery → seg:kit.views.Discovery
  if (rel.startsWith('packages/')) {
    const parts = rel.replace('packages/', '').replace('/src/', '.').split('/');
    return `seg:${parts.join('.')}`;
  }

  // node_modules/some-lib → seg:nm.some-lib
  if (rel.includes('node_modules/')) {
    const afterNm = rel.split('node_modules/').pop();
    return `seg:nm.${afterNm.split('/')[0]}`;
  }

  // Default: use file path
  return `seg:${rel.replace(/\//g, '.')}`;
}

// ---------------------------------------------------------------------------
// Stable segmentId allocation
// ---------------------------------------------------------------------------

const SEGMENT_ID_BASE = 1000; // Start segment IDs from 1000

function allocateSegmentIds(segmentKeys) {
  const sorted = [...segmentKeys].sort();
  const idMap = new Map();
  sorted.forEach((key, index) => {
    idMap.set(key, SEGMENT_ID_BASE + index);
  });
  return idMap;
}

// ---------------------------------------------------------------------------
// SHA-256 for segment integrity
// ---------------------------------------------------------------------------

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// Segment source map generator (#32)
// ---------------------------------------------------------------------------

function generateSegmentSourceMap(segModules, graph, _fileToIdMap, moduleIdToAbsPath) {
  const sections = [];
  let lineOffset = 0;

  for (const [moduleId, code] of segModules) {
    const absPath = moduleIdToAbsPath.get(moduleId);
    if (absPath) {
      const modData = graph.dependencies.get(absPath);
      if (modData && modData.output) {
        for (const output of modData.output) {
          if (output.data && output.data.map) {
            sections.push({
              offset: { line: lineOffset, column: 0 },
              map: output.data.map,
            });
          }
        }
      }
    }
    // Count lines in this module's code for the next offset
    const lineCount = typeof code === 'string'
      ? (code.match(/\n/g) || []).length + 1
      : 1;
    lineOffset += lineCount;
  }

  return JSON.stringify({ version: 3, sections });
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

const outputSegmentDir = SEGMENTS_INPUT_DIR;

module.exports = async function segmentSerializer(
  entryPoint,
  prepend,
  graph,
  bundleOptions,
) {
  const asyncFlag = 'async';

  // Step 1: Categorize modules into main vs async chunks
  const mainModuleIds = new Set();
  const asyncRoots = new Map(); // moduleId → absolutePath

  const findAsyncParent = (fatherId) => {
    for (const [rootId] of asyncRoots) {
      if (rootId === fatherId) return rootId;
    }
    return null;
  };

  for (const [key, value] of graph.dependencies) {
    const moduleId = fileToIdMap.get(key);
    const asyncTypes = [...value.inverseDependencies].map((absolutePath) => {
      const parentId = fileToIdMap.get(absolutePath);
      const parentModule = graph.dependencies.get(absolutePath);
      for (const [, dep] of parentModule.dependencies) {
        if (dep.absolutePath === key) {
          const existingChunk = findAsyncParent(parentId);
          if (existingChunk && dep.data.data.asyncType === null) {
            return existingChunk;
          }
          return dep.data.data.asyncType;
        }
      }
      return undefined;
    });

    if (asyncTypes.length === 0 || asyncTypes.some((v) => v === null)) {
      mainModuleIds.add(moduleId);
    } else if (asyncTypes.every((v) => v === asyncFlag)) {
      asyncRoots.set(moduleId, key);
    } else if (asyncTypes.length === 1 && asyncRoots.has(asyncTypes[0])) {
      // Child of an async root — stays out of main (handled in Step 2 re-scan)
    } else {
      mainModuleIds.add(moduleId);
    }
  }

  // Step 2: Build module allocation map
  const segmentModules = new Map(); // segmentKey → Set<moduleId>
  const moduleToSegment = new Map(); // moduleId → segmentKey

  for (const [moduleId, absolutePath] of asyncRoots) {
    const segmentKey = deriveSegmentKey(absolutePath);
    if (!segmentModules.has(segmentKey)) {
      segmentModules.set(segmentKey, new Set());
    }
    segmentModules.get(segmentKey).add(moduleId);
    moduleToSegment.set(moduleId, segmentKey);
  }

  // Re-scan children: modules only reachable from async roots go into their segment
  for (const [key, value] of graph.dependencies) {
    const moduleId = fileToIdMap.get(key);
    if (mainModuleIds.has(moduleId) || moduleToSegment.has(moduleId)) continue;

    // Check if all parents are in the same segment
    const parentSegments = new Set();
    for (const parentPath of value.inverseDependencies) {
      const parentId = fileToIdMap.get(parentPath);
      const parentSeg = moduleToSegment.get(parentId);
      if (parentSeg) parentSegments.add(parentSeg);
      else parentSegments.add('main');
    }

    if (parentSegments.size === 1 && !parentSegments.has('main')) {
      const seg = [...parentSegments][0];
      segmentModules.get(seg).add(moduleId);
      moduleToSegment.set(moduleId, seg);
    } else {
      mainModuleIds.add(moduleId);
    }
  }

  // Step 3: Allocate stable segment IDs
  const segmentIdMap = allocateSegmentIds([...segmentModules.keys()]);

  // Step 4: Build bundle using Metro's baseJSBundle
  const { pre, post, modules } = baseJSBundle(
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  );

  // Step 5: Split modules into main entry and segment files
  const mainModules = [];
  const segmentOutputs = new Map(); // segmentKey → [moduleId, code][]

  for (const [moduleId, moduleCode] of modules) {
    const seg = moduleToSegment.get(moduleId);
    if (seg) {
      if (!segmentOutputs.has(seg)) {
        segmentOutputs.set(seg, []);
      }
      segmentOutputs.get(seg).push([moduleId, moduleCode]);
    } else {
      mainModules.push([moduleId, moduleCode]);
    }
  }

  // Step 6: Compute inter-segment dependencies
  // Build moduleId → absolutePath reverse index first to avoid O(n²) graph scan (#27)
  const moduleIdToAbsPath = new Map();
  for (const [absPath] of graph.dependencies) {
    const id = fileToIdMap.get(absPath);
    if (id !== undefined) {
      moduleIdToAbsPath.set(id, absPath);
    }
  }

  // Segment A dependsOn segment B if any module in A imports a module in B
  const segmentDeps = new Map(); // segmentKey → Set<segmentKey>
  for (const [segmentKey, modIds] of segmentModules) {
    const deps = new Set();
    for (const modId of modIds) {
      const absPath = moduleIdToAbsPath.get(modId);
      if (!absPath) continue;
      const modData = graph.dependencies.get(absPath);
      if (!modData) continue;
      for (const [, dep] of modData.dependencies) {
        const depId = fileToIdMap.get(dep.absolutePath);
        const depSeg = moduleToSegment.get(depId);
        if (depSeg && depSeg !== segmentKey) {
          deps.add(depSeg);
        }
      }
    }
    segmentDeps.set(segmentKey, deps);
  }

  // Step 6b: Detect cycles in segment dependency DAG (#28)
  // Topological sort — if we can't visit all segments, a cycle exists.
  {
    const visited = new Set();
    const inStack = new Set();
    const cyclePath = [];
    let hasCycle = false;

    function dfs(node) {
      if (hasCycle) return;
      if (inStack.has(node)) {
        hasCycle = true;
        cyclePath.push(node);
        return;
      }
      if (visited.has(node)) return;
      inStack.add(node);
      const neighbors = segmentDeps.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor);
          if (hasCycle) {
            cyclePath.push(node);
            return;
          }
        }
      }
      inStack.delete(node);
      visited.add(node);
    }

    for (const segKey of segmentDeps.keys()) {
      dfs(segKey);
      if (hasCycle) break;
    }

    if (hasCycle) {
      const cycle = cyclePath.reverse().join(' → ');
      throw new Error(
        `[segmentSerializer] Circular segment dependency detected: ${cycle}\n` +
        'Segment dependsOn graph must be a DAG. Fix the import structure to break the cycle.',
      );
    }
  }

  // Step 6c: Derive runtime from segment key path (#25)
  // Uses precise prefix matching on the OneKey package structure:
  //   seg:kit-bg.xxx → background (only exact "kit-bg." prefix)
  //   seg:kit.views.xxx → main (only exact "kit.views." prefix)
  //   seg:components.xxx → main (only exact "components." prefix)
  // NOTE: runtimeTarget override was removed (#36) — in single-entry builds,
  // overriding all segments to the current target would make 'shared' impossible.
  // The override only makes sense in a future union-graph build.
  function deriveRuntime(segmentKey) {
    // Strip "seg:" prefix for matching
    const keyPath = segmentKey.replace(/^seg:/, '');
    if (keyPath.startsWith('kit-bg.')) {
      return 'background';
    }
    if (keyPath.startsWith('kit.views.') || keyPath.startsWith('components.')) {
      return 'main';
    }
    return 'shared';
  }

  // Step 7: Write segment files and build manifest
  const manifest = { segments: {} };

  if (segmentOutputs.size > 0) {
    await fs.ensureDir(outputSegmentDir);
  }

  for (const [segmentKey, segModules] of segmentOutputs) {
    const segmentId = segmentIdMap.get(segmentKey);
    const { code } = bundleToString({
      pre: '',
      post: '',
      modules: segModules,
    });

    const segHash = sha256(Buffer.from(code));
    const safeName = segmentKey.replace(/^seg:/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = `segments/${safeName}.seg.js`;
    const outputPath = path.resolve(outputSegmentDir, `${safeName}.seg.js`);

    await fs.writeFile(outputPath, code);

    // Write packager source map for Sentry symbolication (#32)
    const packagerMapPath = path.resolve(outputSegmentDir, `${safeName}.seg.packager.map`);
    const sourceMap = generateSegmentSourceMap(segModules, graph, fileToIdMap, moduleIdToAbsPath);
    await fs.writeFile(packagerMapPath, sourceMap);

    console.log(
      `info Writing segment: ${segmentKey} (id=${segmentId}, modules=${segModules.length}) → ${outputPath}`,
    );

    const deps = segmentDeps.get(segmentKey);
    manifest.segments[segmentKey] = {
      id: segmentId,
      key: segmentKey,
      runtime: deriveRuntime(segmentKey),
      relativePath,
      sha256: segHash,
      dependsOn: deps ? [...deps].sort() : [],
      size: Buffer.byteLength(code),
    };
  }

  // Step 8: Inject manifest into main bundle as __SEGMENT_MANIFEST__
  const manifestCode = `globalThis.__SEGMENT_MANIFEST__=${JSON.stringify(manifest)};`;
  // Prepend manifest before the first module
  const preWithManifest = `${pre}\n${manifestCode}\n`;

  // Step 9: Write manifest to disk for build-bundle.js consumption
  const manifestPath = SEGMENT_MANIFEST_PATH;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`info Writing segment manifest → ${manifestPath}`);

  // Step 10: Rewrite asyncRequire paths for production
  // In production mode, replace dev server URLs with segment keys.
  // mod is [moduleId, codeString] — only process string code entries.
  if (!bundleOptions.dev) {
    for (const mod of mainModules) {
      if (typeof mod[1] !== 'string') continue;
      for (const [moduleId, segmentKey] of moduleToSegment) {
        // Match asyncRequire path map entries: e.g. "12345":"http://..."
        // Use word boundary after the ID to avoid matching longer numeric IDs
        const pattern = new RegExp(
          `"${moduleId}"(\\s*:\\s*)"[^"]*"`,
          'g',
        );
        mod[1] = mod[1].replace(pattern, `"${moduleId}"$1"${segmentKey}"`);
      }
    }
  }

  return bundleToString({
    pre: preWithManifest,
    post,
    modules: mainModules,
  });
};
