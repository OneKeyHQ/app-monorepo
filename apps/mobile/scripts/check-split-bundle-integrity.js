#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error, no-plusplus, no-continue */
/**
 * Split-bundle integrity check.
 *
 * Scans every segment's emitted JS for `__d(fn, moduleId, [deps])` blocks and
 * verifies that every sync dependency edge crossing a segment boundary is
 * covered by the segment's transitive `dependsOn` closure.
 *
 * If any edge isn't covered, the segment's runtime would hit
 * "Requiring unknown module <N>" when it's loaded standalone — the target
 * module's segment never gets loaded.
 *
 * Inputs (produced by build-bundle.js / unionBuild.js):
 *   - apps/mobile/dist/segments/             — main-runtime .seg.js files
 *   - apps/mobile/dist/segments-background/  — bg-runtime .seg.js files
 *   - apps/mobile/dist/segment-manifest.json
 *   - apps/mobile/dist/segment-manifest-background.json
 *   - apps/mobile/out-dir-bundle/<platform>/dist/module-id-map.json (any platform works — eager ID sets are identical across platforms for our monorepo)
 *
 * Exit codes:
 *   0 — clean
 *   1 — cross-segment sync violation(s) or structural problem
 */
const fs = require('fs');
const path = require('path');

const MOBILE_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(MOBILE_DIR, 'dist');
const SEGMENTS_MAIN = path.join(DIST_DIR, 'segments');
const SEGMENTS_BG = path.join(DIST_DIR, 'segments-background');
const MANIFEST_MAIN = path.join(DIST_DIR, 'segment-manifest.json');
const MANIFEST_BG = path.join(DIST_DIR, 'segment-manifest-background.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Locate module-id-map.json. unionBuild.js writes the authoritative union map
 * to apps/mobile/dist/module-id-map.json — always present post-unionBuild both
 * locally and on EAS. build-bundle.js additionally copies a per-platform
 * version to out-dir-bundle/<platform>/dist/module-id-map.json (only populated
 * by the local --platform flow). Prefer dist; fall back to out-dir-bundle.
 */
function findModuleIdMap() {
  const primary = path.join(DIST_DIR, 'module-id-map.json');
  if (fs.existsSync(primary)) return primary;
  const outDir = path.join(MOBILE_DIR, 'out-dir-bundle');
  if (!fs.existsSync(outDir)) return null;
  for (const platform of fs.readdirSync(outDir)) {
    const candidate = path.join(outDir, platform, 'dist', 'module-id-map.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Parse a Metro serialized `__d(fn, moduleId, [deps])` call from a segment JS
 * bundle. Returns an array of { moduleId, deps } objects.
 *
 * Why we parse manually: the segment files can be 10+ MB of minified JS; we
 * only need the module-def prologue, which is trivially regex-scannable once
 * we brace-match the function body.
 */
function parseModuleDefs(segmentJs) {
  const results = [];
  const chunks = segmentJs.split('__d(');
  // chunks[0] is pre-`__d(` content (usually empty), skip it.
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    // Brace-match the factory function body.
    let depth = 0;
    let endIdx = -1;
    let inString = null;
    // We start at the opening `f` of `function(...){...}`. Skim past the `(`
    // and into the body — simplest: find the first `{` and brace-count from
    // there, respecting single/double quotes.
    for (let j = 0; j < chunk.length; j++) {
      const ch = chunk[j];
      if (inString) {
        if (ch === '\\') {
          j += 1; // skip escape
          continue;
        }
        if (ch === inString) {
          inString = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          endIdx = j;
          break;
        }
      }
    }
    if (endIdx === -1) continue;

    // After closing `}` should come `,<moduleId>,[<dep0>,<dep1>,...])`
    const rest = chunk.slice(endIdx + 1, endIdx + 1 + 20_000);
    const m = rest.match(/^,(\d+),\[([^\]]*)\]/);
    if (!m) continue;
    const moduleId = Number(m[1]);
    const deps = m[2]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    results.push({ moduleId, deps });
  }
  return results;
}

/**
 * Build a filename → segmentKey map by reading each manifest entry's
 * `relativePath`. The serializer sanitizes segment keys before writing them
 * to disk (e.g. `@` → `_`), so we can't just prepend `seg:` to the filename —
 * we have to consult the manifest which preserves the original key.
 */
function buildFilenameToSegmentKey(manifest, _segmentsDirBase) {
  // relativePath looks like 'segments/<safeName>.seg.hbc' or
  // 'segments-background/<safeName>.seg.hbc'. The .seg.js we scan has the
  // same safeName with .seg.js extension.
  const map = new Map();
  for (const [segKey, entry] of Object.entries(manifest.segments || {})) {
    if (!entry.relativePath) continue;
    // Strip the dir prefix and extension to recover safeName.
    const basename = path.basename(entry.relativePath, '.seg.hbc');
    map.set(`${basename}.seg.js`, segKey);
  }
  return map;
}

function transitiveClosure(manifest, startSegKey) {
  const visited = new Set();
  const queue = [startSegKey];
  while (queue.length > 0) {
    const cur = queue.pop();
    if (visited.has(cur)) continue;
    visited.add(cur);
    const entry = manifest.segments[cur];
    if (!entry) continue;
    for (const dep of entry.dependsOn || []) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }
  return visited;
}

/**
 * Build moduleId -> segmentKey from idMap.segments (the authoritative source
 * of per-segment module membership). segment-manifest.json only carries
 * dependsOn/id/runtime/sha256 — it does NOT list modules — so reading the
 * ownership map from there silently produces an empty index and makes the
 * whole integrity check a no-op.
 *
 * The `manifest` argument is still accepted so we can skip segments that
 * don't belong to this runtime's manifest (avoids cross-runtime leakage when
 * scanning main vs background).
 */
function buildModuleIndex(idMap, manifest) {
  const index = new Map();
  const allowedSegKeys = new Set(Object.keys(manifest.segments || {}));
  for (const [segKey, entry] of Object.entries(idMap.segments || {})) {
    if (!allowedSegKeys.has(segKey)) continue;
    const modules = entry.modules || {};
    for (const idStr of Object.keys(modules)) {
      index.set(Number(idStr), segKey);
    }
  }
  return index;
}

// Backwards-compat alias — tests and external callers may still use the old
// name. Delegates to the new signature by treating its argument as either
// shape: an idMap (has `.segments[].modules`) or a legacy manifest fixture
// that embeds `modules` directly under segments.
function buildModuleIndexFromManifest(manifestOrIdMap) {
  const index = new Map();
  for (const [segKey, entry] of Object.entries(
    manifestOrIdMap.segments || {},
  )) {
    const modules = entry.modules || {};
    for (const idStr of Object.keys(modules)) {
      index.set(Number(idStr), segKey);
    }
  }
  return index;
}

function buildEagerIdSet(idMap, runtimeBucketNames) {
  // Module ids in the eager bundle(s) for a runtime.
  // `runtimeBucketNames` is a subset of ['common', 'main', 'background'].
  const eager = new Set();
  for (const bucket of runtimeBucketNames) {
    const entries = idMap[bucket] || {};
    for (const idStr of Object.keys(entries)) {
      eager.add(Number(idStr));
    }
  }
  return eager;
}

/**
 * Scan one runtime's segments directory.
 *
 * For each `.seg.js`:
 *   For each module's dep list:
 *     For each dep id:
 *       - Skip if dep is in eager bundle
 *       - Skip if dep is defined in the same segment
 *       - Require dep's segment to be in this segment's transitive dependsOn
 *       - Otherwise record violation
 */
function scanRuntime({
  runtimeLabel,
  segmentsDir,
  manifest,
  idMap,
  runtimeBucketNames,
  // Optional predicate (segKey, idMapEntry) => boolean. When provided,
  // restricts the scan to segments the filter accepts. Used by main() to run
  // a bg-scoped pass over shared segments (which live on disk under
  // SEGMENTS_MAIN even though bg needs to verify its own ownership).
  segmentKeyFilter,
}) {
  const violations = [];
  if (!fs.existsSync(segmentsDir)) {
    return { violations, scannedSegments: 0 };
  }

  // We need a per-runtime module index so a 'main' segment's dep lookup
  // resolves against main's segment definitions (from its manifest), and a
  // 'background' segment's deps resolve against bg's definitions. The actual
  // module→segment ownership lives in idMap.segments, NOT in the manifest.
  const moduleToSegment = buildModuleIndex(idMap, manifest);
  const eager = buildEagerIdSet(idMap, runtimeBucketNames);

  // id -> path (for prettier error messages). Prefer segment definitions,
  // fall back to any bucket.
  const idToPath = new Map();
  for (const [bucket, entries] of Object.entries(idMap)) {
    if (bucket === 'segments') continue;
    for (const [idStr, p] of Object.entries(entries)) {
      if (!idToPath.has(Number(idStr))) idToPath.set(Number(idStr), p);
    }
  }
  for (const entry of Object.values(idMap.segments || {})) {
    for (const [idStr, p] of Object.entries(entry.modules || {})) {
      if (!idToPath.has(Number(idStr))) idToPath.set(Number(idStr), p);
    }
  }

  const filenameToSegKey = buildFilenameToSegmentKey(manifest, segmentsDir);
  let scannedSegments = 0;
  for (const fname of fs.readdirSync(segmentsDir)) {
    if (!fname.endsWith('.seg.js')) continue;
    const segKey = filenameToSegKey.get(fname);
    if (!segKey || !manifest.segments[segKey]) {
      if (segmentKeyFilter) {
        // Filtered passes are intentionally partial (e.g. a bg-scoped pass
        // over main's segments directory). Non-matching files belong to
        // other passes and are not structural bugs for this one.
        continue;
      }
      // Manifest entry missing for an emitted segment — itself a structural bug.
      violations.push({
        kind: 'missing_manifest_entry',
        runtime: runtimeLabel,
        segment: segKey || `<unknown for ${fname}>`,
        message: `Segment file ${fname} has no entry in ${runtimeLabel} manifest`,
      });
      continue;
    }
    if (
      segmentKeyFilter &&
      !segmentKeyFilter(segKey, idMap.segments?.[segKey])
    ) {
      continue;
    }

    scannedSegments += 1;
    const closure = transitiveClosure(manifest, segKey);
    const segJs = fs.readFileSync(path.join(segmentsDir, fname), 'utf8');
    const moduleDefs = parseModuleDefs(segJs);

    // For shared segments, the emitted .seg.js ships __d(...) for every
    // module EITHER runtime reaches, but only one runtime actually calls
    // into each module at runtime (the other side just carries the inert
    // definition). Scope the sync-dep check to this runtime's ownership
    // so we don't false-positive on transitive deps of modules the current
    // runtime never invokes (e.g. main scanning DMK's require("rxjs")
    // where rxjs lives only in a bg-specific segment).
    const idMapEntry = idMap.segments?.[segKey];
    let ownedIds = null;
    if (idMapEntry?.runtime === 'shared') {
      ownedIds =
        runtimeLabel === 'main' ? idMapEntry.mainOwned : idMapEntry.bgOwned;
    }
    const ownedIdSet = ownedIds
      ? new Set(Object.keys(ownedIds).map(Number))
      : null;

    for (const { moduleId, deps } of moduleDefs) {
      if (ownedIdSet && !ownedIdSet.has(moduleId)) continue;
      for (const depId of deps) {
        if (eager.has(depId)) continue; // eager — always available
        const depSeg = moduleToSegment.get(depId);
        if (depSeg === segKey) continue; // same segment — OK
        if (depSeg) {
          // The dep is owned by another segment in THIS runtime.
          if (closure.has(depSeg)) continue; // covered by transitive dependsOn — OK
          violations.push({
            kind: 'cross_segment_sync',
            runtime: runtimeLabel,
            srcSegment: segKey,
            srcModuleId: moduleId,
            srcModulePath: idToPath.get(moduleId) || `<unknown ${moduleId}>`,
            depSegment: depSeg,
            depModuleId: depId,
            depModulePath: idToPath.get(depId) || `<unknown ${depId}>`,
          });
          continue;
        }
        // Orphan: dep isn't in eager and isn't owned by any segment in this
        // runtime's manifest. At runtime this becomes
        // "Requiring unknown module <depId>" — flag it.
        violations.push({
          kind: 'orphan_dep',
          runtime: runtimeLabel,
          srcSegment: segKey,
          srcModuleId: moduleId,
          srcModulePath: idToPath.get(moduleId) || `<unknown ${moduleId}>`,
          depModuleId: depId,
          depModulePath: idToPath.get(depId) || `<unknown ${depId}>`,
        });
      }
    }
  }
  return { violations, scannedSegments };
}

function formatPath(p) {
  if (typeof p !== 'string') return '(unknown)';
  const idx = p.indexOf('packages/');
  if (idx >= 0) return p.slice(idx);
  return p;
}

function printViolations(violations) {
  const groups = new Map();
  const structural = [];
  const orphans = [];
  for (const v of violations) {
    if (v.kind === 'cross_segment_sync') {
      const key = `${v.runtime}::${v.srcSegment} -> ${v.depSegment}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
      continue;
    }
    if (v.kind === 'orphan_dep') {
      orphans.push(v);
      continue;
    }
    structural.push(v);
  }

  for (const s of structural) {
    console.error(`[integrity][${s.runtime}] ${s.kind}: ${s.message}`);
  }

  const keys = [...groups.keys()].toSorted();
  for (const key of keys) {
    const list = groups.get(key);
    const sample = list[0];
    console.error(`[integrity][${sample.runtime}] ${sample.srcSegment}`);
    console.error(`    → ${sample.depSegment}`);
    console.error(
      `    ${list.length} sync edge(s) not covered by dependsOn. First 3:`,
    );
    for (const v of list.slice(0, 3)) {
      console.error(
        `      module ${v.srcModuleId} (${formatPath(v.srcModulePath)})`,
      );
      console.error(
        `        → module ${v.depModuleId} (${formatPath(v.depModulePath)})`,
      );
    }
  }

  if (orphans.length > 0) {
    console.error('');
    console.error(
      `[integrity] ORPHAN DEPS (${orphans.length}) — will crash at runtime:`,
    );
    for (const v of orphans.slice(0, 10)) {
      console.error(
        `  [${v.runtime}] ${v.srcSegment} id=${v.srcModuleId} (${formatPath(v.srcModulePath)})`,
      );
      console.error(
        `    → id=${v.depModuleId} (${formatPath(v.depModulePath)}) NOT in any bundle/segment`,
      );
    }
    if (orphans.length > 10) {
      console.error(`  ... and ${orphans.length - 10} more`);
    }
  }
}

function main() {
  const problems = [];
  if (!fs.existsSync(MANIFEST_MAIN)) {
    problems.push(`Missing: ${MANIFEST_MAIN}`);
  }
  if (!fs.existsSync(MANIFEST_BG)) {
    problems.push(`Missing: ${MANIFEST_BG}`);
  }
  const idMapPath = findModuleIdMap();
  if (!idMapPath) {
    problems.push(
      'Missing: apps/mobile/dist/module-id-map.json (or out-dir-bundle/<platform>/dist/module-id-map.json)',
    );
  }
  if (problems.length > 0) {
    console.error(
      '[check-split-bundle-integrity] Required build artifacts not found:',
    );
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      'Run `node apps/mobile/scripts/unionBuild.js` (invoked automatically by build-bundle.js / gradle unionBuildProdRelease) first.',
    );
    process.exit(1);
  }

  const manifestMain = readJson(MANIFEST_MAIN);
  const manifestBg = readJson(MANIFEST_BG);
  const idMap = readJson(idMapPath);

  const mainRuntime = scanRuntime({
    runtimeLabel: 'main',
    segmentsDir: SEGMENTS_MAIN,
    manifest: manifestMain,
    idMap,
    runtimeBucketNames: ['common', 'main'],
  });
  const bg = scanRuntime({
    runtimeLabel: 'background',
    segmentsDir: SEGMENTS_BG,
    manifest: manifestBg,
    idMap,
    runtimeBucketNames: ['common', 'background'],
  });
  // Shared-segment files live only under SEGMENTS_MAIN even though both
  // runtimes load them. The main pass above checks main-owned modules; the
  // bg pass above can't see these files. Run a third bg-scoped pass on
  // SEGMENTS_MAIN restricted to shared segments so bg-owned modules inside
  // them get their sync deps verified.
  const bgShared = scanRuntime({
    runtimeLabel: 'background',
    segmentsDir: SEGMENTS_MAIN,
    manifest: manifestBg,
    idMap,
    runtimeBucketNames: ['common', 'background'],
    segmentKeyFilter: (_segKey, idMapEntry) => idMapEntry?.runtime === 'shared',
  });

  const allViolations = [
    ...mainRuntime.violations,
    ...bg.violations,
    ...bgShared.violations,
  ];
  console.log(
    `[check-split-bundle-integrity] scanned ${mainRuntime.scannedSegments} main + ${bg.scannedSegments} bg + ${bgShared.scannedSegments} bg-shared segments`,
  );
  console.log(
    `[check-split-bundle-integrity] main violations: ${mainRuntime.violations.length}`,
  );
  console.log(
    `[check-split-bundle-integrity] bg violations:   ${bg.violations.length}`,
  );

  if (allViolations.length === 0) {
    console.log(
      '[check-split-bundle-integrity] OK — no cross-segment sync violations or orphan deps.',
    );
    process.exit(0);
  }

  console.error('');
  console.error(
    '[check-split-bundle-integrity] FAIL — split-bundle integrity violations (cross-segment sync or orphan deps):',
  );
  console.error('');
  printViolations(allViolations);
  console.error('');
  console.error(
    'Each violation is a latent "Requiring unknown module" crash: the source segment sync-requires a module whose defining segment is not loaded first (cross_segment_sync) or whose definition ships nowhere (orphan_dep).',
  );
  console.error(
    "Fixes: (1) promote the shared module to a dedicated seg:shared.* segment (allocator), (2) extend the source segment's dependsOn chain, or (3) add the orphan path to apps/mobile/bundle-groups.config.js or keep it in the eager bundle.",
  );
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseModuleDefs,
  transitiveClosure,
  buildModuleIndex,
  buildModuleIndexFromManifest,
  buildEagerIdSet,
  scanRuntime,
};
