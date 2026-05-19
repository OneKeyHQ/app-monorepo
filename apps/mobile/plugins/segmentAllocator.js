/* eslint-disable no-continue */
/**
 * Segment allocator — pure classification logic used by segmentSerializer.
 *
 * Reassigns "unclassified descendants" (modules that are neither eager nor
 * an async root) to:
 *   - the existing owning segment when all sync parents live in one segment
 *   - a dedicated `seg:shared.*` segment when sync parents span two+
 *     segments — avoids cross-segment sync-require crashes at runtime
 *   - the eager main bundle when any parent is main-reachable
 *
 * Extracted from segmentSerializer.js so the multi-root promotion behavior
 * can be unit-tested without a full Metro graph.
 */

const { deriveSharedSegmentKey } = require('./segmentUtils');

/**
 * Iterate over the graph until every non-entry module has been placed.
 *
 * Inputs (mutated in place — serializer caller owns these structures):
 *   - graph:             Metro-shaped graph { dependencies: Map<absPath, {inverseDependencies}> }
 *   - fileToIdMap:       { get(absPath): moduleId | undefined }
 *   - mainModuleIds:     Set<moduleId>           (built by Step 1; extended here)
 *   - segmentModules:    Map<segmentKey, Set<moduleId>>  (seeded by Step 2; extended here)
 *   - moduleToSegment:   Map<moduleId, segmentKey>       (seeded by Step 2; extended here)
 *
 * Returns:
 *   - promotedSharedModules: Map<moduleId, { sharedSeg, consumers: Set<segmentKey> }>
 *     For reporting / tests. A module in this map had >=2 distinct segment
 *     parents and got moved into its own shared segment.
 */
function reassignDescendantsToSegments({
  graph,
  fileToIdMap,
  mainModuleIds,
  segmentModules,
  moduleToSegment,
}) {
  const promotedSharedModules = new Map();

  let rescanChanged = true;
  while (rescanChanged) {
    rescanChanged = false;
    for (const [key, value] of graph.dependencies) {
      const moduleId = fileToIdMap.get(key);
      if (moduleId === undefined) continue;
      if (mainModuleIds.has(moduleId) || moduleToSegment.has(moduleId)) {
        continue;
      }

      // Collect parent classifications.
      const parentSegments = new Set();
      let hasUnresolvedParent = false;
      const invDeps = value.inverseDependencies || [];
      for (const parentPath of invDeps) {
        const parentId = fileToIdMap.get(parentPath);
        const parentSeg = moduleToSegment.get(parentId);
        if (parentSeg) {
          parentSegments.add(parentSeg);
        } else if (mainModuleIds.has(parentId)) {
          parentSegments.add('main');
        } else {
          hasUnresolvedParent = true;
        }
      }

      if (hasUnresolvedParent) continue;

      if (parentSegments.has('main')) {
        // Any eager-reachable parent pulls the module into main.
        mainModuleIds.add(moduleId);
        rescanChanged = true;
      } else if (parentSegments.size === 1) {
        // Exactly one segment parent — safe to co-locate.
        const seg = [...parentSegments][0];
        if (!segmentModules.has(seg)) segmentModules.set(seg, new Set());
        segmentModules.get(seg).add(moduleId);
        moduleToSegment.set(moduleId, seg);
        rescanChanged = true;
      } else if (parentSegments.size >= 2) {
        // Multi-root sync share → dedicated `seg:shared.*` segment. The
        // outer Step 6 in serializer will compute segmentDeps and each
        // consumer root will get `dependsOn: [sharedSeg]` recorded in the
        // manifest, so the runtime pre-loads the shared module first.
        const sharedSeg = deriveSharedSegmentKey(key);
        if (!segmentModules.has(sharedSeg)) {
          segmentModules.set(sharedSeg, new Set());
        }
        segmentModules.get(sharedSeg).add(moduleId);
        moduleToSegment.set(moduleId, sharedSeg);
        promotedSharedModules.set(moduleId, {
          sharedSeg,
          consumers: new Set(parentSegments),
        });
        rescanChanged = true;
      } else {
        // No parents at all — degenerate case, keep eager.
        mainModuleIds.add(moduleId);
        rescanChanged = true;
      }
    }
  }

  return { promotedSharedModules };
}

module.exports = { reassignDescendantsToSegments };
