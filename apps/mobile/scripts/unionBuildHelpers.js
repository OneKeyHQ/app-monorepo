/* eslint-disable onekey/no-raw-error */
const crypto = require('crypto');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function setEquals(left, right) {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function buildModuleSignature(moduleData) {
  if (!moduleData) {
    return '';
  }
  const outputs = (moduleData.output || []).map((output) => ({
    type: output.type,
    code: output.data?.code || '',
  }));
  const dependencies = [...moduleData.dependencies.entries()]
    .map(([key, dep]) => ({
      key,
      absolutePath: dep.absolutePath,
      asyncType:
        dep.data && dep.data.data ? (dep.data.data.asyncType ?? null) : null,
      isOptional:
        dep.data && 'isOptional' in dep.data ? dep.data.isOptional : false,
    }))
    .toSorted((left, right) =>
      `${left.key}:${left.absolutePath}`.localeCompare(
        `${right.key}:${right.absolutePath}`,
      ),
    );
  return sha256(JSON.stringify({ outputs, dependencies }));
}

function buildRuntimeOwnership({
  mainGraph,
  bgGraph,
  mainReachable,
  bgReachable,
  mainStartupAbsPaths,
  bgStartupAbsPaths,
}) {
  const mainSignatures = new Map();
  const bgSignatures = new Map();

  for (const [absolutePath, moduleData] of mainGraph.dependencies) {
    mainSignatures.set(absolutePath, buildModuleSignature(moduleData));
  }
  for (const [absolutePath, moduleData] of bgGraph.dependencies) {
    bgSignatures.set(absolutePath, buildModuleSignature(moduleData));
  }

  const allAbsPaths = new Set([
    ...mainGraph.dependencies.keys(),
    ...bgGraph.dependencies.keys(),
  ]);
  const sharedEquivalentAbsPaths = new Set();
  const mainOnlyAbsPaths = new Set();
  const bgOnlyAbsPaths = new Set();

  for (const absolutePath of allAbsPaths) {
    const inMain = mainSignatures.has(absolutePath);
    const inBg = bgSignatures.has(absolutePath);
    const isSharedEquivalent =
      inMain &&
      inBg &&
      mainSignatures.get(absolutePath) === bgSignatures.get(absolutePath);

    if (isSharedEquivalent) {
      sharedEquivalentAbsPaths.add(absolutePath);
    } else {
      if (inMain) {
        mainOnlyAbsPaths.add(absolutePath);
      }
      if (inBg) {
        bgOnlyAbsPaths.add(absolutePath);
      }
    }
  }

  const mainStartupCandidates =
    mainStartupAbsPaths || mainReachable || new Set();
  const bgStartupCandidates = bgStartupAbsPaths || bgReachable || new Set();

  const sharedStartupAbsPaths = new Set(
    [...sharedEquivalentAbsPaths].filter(
      (absolutePath) =>
        mainStartupCandidates.has(absolutePath) &&
        bgStartupCandidates.has(absolutePath),
    ),
  );

  // Expand shared startup set with sync dependencies.
  // A shared module (e.g., defiUtils.ts) may sync-depend on a module that
  // only exists in one graph (e.g., a crypto lib only in the bg graph).
  // That dep must also be in the common bundle, so promote it to shared.
  // We follow sync deps in BOTH graphs to cover all transitive deps.
  const pendingShared = [...sharedStartupAbsPaths];
  while (pendingShared.length > 0) {
    const current = pendingShared.pop();
    // Check sync deps in both graphs
    for (const graph of [mainGraph, bgGraph]) {
      const mod = graph.dependencies.get(current);
      if (mod) {
        for (const [, dep] of mod.dependencies) {
          if (
            dep.data?.data?.asyncType !== 'async' &&
            !sharedStartupAbsPaths.has(dep.absolutePath)
          ) {
            // Promote this sync dep to shared
            sharedStartupAbsPaths.add(dep.absolutePath);
            pendingShared.push(dep.absolutePath);
          }
        }
      }
    }
  }

  const mainStartupOnlyAbsPaths = new Set(
    [...mainStartupCandidates].filter(
      (absolutePath) => !sharedStartupAbsPaths.has(absolutePath),
    ),
  );
  const bgStartupOnlyAbsPaths = new Set(
    [...bgStartupCandidates].filter(
      (absolutePath) => !sharedStartupAbsPaths.has(absolutePath),
    ),
  );

  return {
    allAbsPaths,
    sharedEquivalentAbsPaths,
    sharedStartupAbsPaths,
    mainStartupAbsPaths: mainStartupOnlyAbsPaths,
    bgStartupAbsPaths: bgStartupOnlyAbsPaths,
    mainOnlyAbsPaths,
    bgOnlyAbsPaths,
  };
}

function buildGraphModuleIndex(graph, createModuleId) {
  const moduleIdToAbsPath = new Map();
  const absPathToModuleId = new Map();

  for (const [absolutePath] of graph.dependencies) {
    const moduleId = createModuleId(absolutePath);
    moduleIdToAbsPath.set(moduleId, absolutePath);
    absPathToModuleId.set(absolutePath, moduleId);
  }

  return {
    moduleIdToAbsPath,
    absPathToModuleId,
  };
}

function createAbsolutePathToSegmentMap({
  graph,
  moduleToSegment,
  getGraphModuleId,
}) {
  const absPathToSegment = new Map();

  for (const [absolutePath] of graph.dependencies) {
    const segmentKey = moduleToSegment.get(getGraphModuleId(absolutePath));
    if (segmentKey) {
      absPathToSegment.set(absolutePath, segmentKey);
    }
  }

  return absPathToSegment;
}

function createSerializedModuleToSegmentMap({
  moduleIdToAbsPath,
  absPathToSegment,
}) {
  const serializedModuleToSegment = new Map();

  for (const [moduleId, absolutePath] of moduleIdToAbsPath) {
    const segmentKey = absPathToSegment.get(absolutePath);
    if (segmentKey) {
      serializedModuleToSegment.set(moduleId, segmentKey);
    }
  }

  return serializedModuleToSegment;
}

function groupSerializedEntriesBySegment({
  serializedEntries,
  absPathToSegment,
  promotedSegmentKeys,
}) {
  const segmentOutputs = new Map();
  const promoted = promotedSegmentKeys || new Set();

  for (const { absolutePath, moduleCode, moduleId } of serializedEntries) {
    const segmentKey = absPathToSegment.get(absolutePath);
    if (segmentKey && !promoted.has(segmentKey)) {
      if (!segmentOutputs.has(segmentKey)) {
        segmentOutputs.set(segmentKey, []);
      }
      segmentOutputs.get(segmentKey).push([moduleId, moduleCode]);
    }
  }

  return segmentOutputs;
}

function seedSegmentAssignments({
  asyncRoots,
  asyncDescendants,
  deriveSegmentKey,
}) {
  const segmentModules = new Map();
  const moduleToSegment = new Map();
  const assignModuleToSegment = (moduleId, segmentKey) => {
    if (!segmentModules.has(segmentKey)) {
      segmentModules.set(segmentKey, new Set());
    }
    segmentModules.get(segmentKey).add(moduleId);
    moduleToSegment.set(moduleId, segmentKey);
  };

  for (const [moduleId, absolutePath] of asyncRoots) {
    assignModuleToSegment(moduleId, deriveSegmentKey(absolutePath));
  }

  for (const [moduleId, rootId] of asyncDescendants) {
    const rootAbsolutePath = asyncRoots.get(rootId);
    if (rootAbsolutePath) {
      assignModuleToSegment(moduleId, deriveSegmentKey(rootAbsolutePath));
    }
  }

  return {
    segmentModules,
    moduleToSegment,
  };
}

function isJsModule(moduleData) {
  return (
    moduleData?.output?.some(
      ({ type }) => typeof type === 'string' && type.startsWith('js/'),
    ) || false
  );
}

function buildSerializedModuleEntries({
  graph,
  serializedModules,
  moduleIdToAbsPath,
}) {
  return serializedModules.map(([moduleId, moduleCode]) => {
    const absolutePath = moduleIdToAbsPath.get(moduleId);
    if (!absolutePath) {
      throw new Error(
        `[unionBuild] Missing graph module for serialized id ${moduleId}`,
      );
    }

    const moduleData = graph.dependencies.get(absolutePath);
    if (!isJsModule(moduleData)) {
      throw new Error(
        `[unionBuild] Serialized id ${moduleId} resolved to non-JS module ${absolutePath}`,
      );
    }

    return {
      absolutePath,
      moduleCode,
      moduleData,
      moduleId,
    };
  });
}

function ensureStatementTerminator(code) {
  return code.endsWith(';') ? code : `${code};`;
}

function buildPostSection({
  bundleOptions,
  entryPoint,
  includePre,
  includedModulePaths,
}) {
  if (!bundleOptions?.runModule) {
    return '';
  }

  const pathsToRequire = includePre
    ? bundleOptions.runBeforeMainModule || []
    : [entryPoint];

  const statements = pathsToRequire
    .filter((modulePath) => includedModulePaths.has(modulePath))
    .map((modulePath) =>
      ensureStatementTerminator(
        bundleOptions.getRunModuleStatement(
          bundleOptions.createModuleId(modulePath),
          bundleOptions.globalPrefix,
        ),
      ),
    );

  return statements.length > 0 ? `${statements.join('\n')}\n` : '';
}

function expandSyncDependencyClosure({
  serializedEntries,
  initialIncludedAbsPaths,
  externalAbsPaths,
}) {
  const external = externalAbsPaths || new Set();
  const includedAbsPaths = new Set(
    [...initialIncludedAbsPaths].filter(
      (absolutePath) => !external.has(absolutePath),
    ),
  );
  const serializedEntryByAbsPath = new Map(
    serializedEntries.map((entry) => [entry.absolutePath, entry]),
  );
  const pending = [...includedAbsPaths];

  while (pending.length > 0) {
    const absolutePath = pending.pop();
    const entry = serializedEntryByAbsPath.get(absolutePath);
    if (entry?.moduleData) {
      for (const [, dep] of entry.moduleData.dependencies) {
        const depAbsolutePath = dep.absolutePath;
        const asyncType = dep.data?.data?.asyncType;
        const shouldIncludeDependency =
          asyncType !== 'async' &&
          !external.has(depAbsolutePath) &&
          !includedAbsPaths.has(depAbsolutePath) &&
          serializedEntryByAbsPath.has(depAbsolutePath);

        if (shouldIncludeDependency) {
          includedAbsPaths.add(depAbsolutePath);
          pending.push(depAbsolutePath);
        }
      }
    }
  }

  return includedAbsPaths;
}

function rewriteAsyncRequirePaths(
  wrappedModules,
  { moduleToSegment, moduleIdToAbsPath, eagerAbsPaths, runtimeVariants } = {},
) {
  const replacementLiterals = new Map();

  if (moduleToSegment) {
    for (const [moduleId, segmentKey] of moduleToSegment) {
      replacementLiterals.set(moduleId, JSON.stringify(segmentKey));
    }
  }

  if (moduleIdToAbsPath && eagerAbsPaths) {
    for (const [moduleId, absolutePath] of moduleIdToAbsPath) {
      if (
        eagerAbsPaths.has(absolutePath) &&
        !replacementLiterals.has(moduleId)
      ) {
        replacementLiterals.set(moduleId, 'null');
      }
    }
  }

  if (runtimeVariants && moduleIdToAbsPath) {
    for (const [moduleId, absolutePath] of moduleIdToAbsPath) {
      const variantValues = Object.fromEntries(
        Object.entries(runtimeVariants)
          .map(([runtime, config]) => {
            if (!config || !absolutePath) {
              return [runtime, undefined];
            }
            if (config.absPathToSegment?.has(absolutePath)) {
              return [runtime, config.absPathToSegment.get(absolutePath)];
            }
            if (config.eagerAbsPaths?.has(absolutePath)) {
              return [runtime, null];
            }
            return [runtime, undefined];
          })
          .filter(([, value]) => value !== undefined),
      );

      const allRuntimeNames = Object.keys(runtimeVariants);
      const runtimeEntries = Object.entries(variantValues);
      if (runtimeEntries.length > 0) {
        // If all configured runtimes have the same value, collapse to a
        // simple literal. But ONLY if every runtime is represented — if
        // some runtimes returned undefined (module not available there),
        // we must emit a per-runtime object so the runtime loader can
        // distinguish "eager/null" from "not available/missing key".
        const coversAllRuntimes =
          runtimeEntries.length === allRuntimeNames.length;
        const [, firstValue] = runtimeEntries[0];
        const allSame =
          coversAllRuntimes &&
          runtimeEntries.every(([, value]) => value === firstValue);

        if (allSame) {
          replacementLiterals.set(
            moduleId,
            firstValue === null ? 'null' : JSON.stringify(firstValue),
          );
        } else {
          const literal = `{${runtimeEntries
            .map(
              ([runtime, value]) =>
                `${JSON.stringify(runtime)}:${
                  value === null ? 'null' : JSON.stringify(value)
                }`,
            )
            .join(',')}}`;
          replacementLiterals.set(moduleId, literal);
        }
      }
    }
  }

  if (replacementLiterals.size === 0) {
    return;
  }

  const idAlternation = [...replacementLiterals.keys()].map(String).join('|');
  const pathsBlockPattern = /("paths"\s*:\s*\{)([^}]*)(\})/g;
  const pathEntryPattern = new RegExp(
    `(^|,)(\\s*)"(${idAlternation})"(\\s*:\\s*)(null|"[^"]*"|\\{[^}]*\\})`,
    'g',
  );

  for (const wrappedModule of wrappedModules) {
    if (typeof wrappedModule[1] === 'string') {
      wrappedModule[1] = wrappedModule[1].replace(
        pathsBlockPattern,
        (_, prefix, body, suffix) => {
          const rewrittenBody = body.replace(
            pathEntryPattern,
            (match, leading, whitespace, moduleId, colon) => {
              const literal = replacementLiterals.get(Number(moduleId));
              if (literal !== undefined) {
                return `${leading}${whitespace}"${moduleId}"${colon}${literal}`;
              }
              return match;
            },
          );
          return `${prefix}${rewrittenBody}${suffix}`;
        },
      );
    }
  }
}

/**
 * Validate that every sync dependency reachable from eager AND segment
 * modules is covered by either the eager bundle set or a segment.
 *
 * Walk from each eager module AND each segment module along synchronous
 * (non-async) dependency edges.  Any module reached that is NOT in
 * eagerAbsPaths and NOT in segmentAbsPaths is reported as missing – it
 * will cause a "Requiring unknown module" crash at runtime.
 */
function validateBundleCompleteness({ graph, eagerAbsPaths, segmentAbsPaths }) {
  const coveredAbsPaths = new Set([...eagerAbsPaths, ...segmentAbsPaths]);
  const visited = new Set();
  const missingAbsPaths = [];
  // Start from BOTH eager and segment modules
  const pending = [...eagerAbsPaths, ...segmentAbsPaths];

  while (pending.length > 0) {
    const absolutePath = pending.pop();
    if (visited.has(absolutePath)) {
      // oxlint-disable-next-line eslint/no-continue
      continue;
    }
    visited.add(absolutePath);

    const moduleData = graph.get(absolutePath);
    if (!moduleData) {
      // oxlint-disable-next-line eslint/no-continue
      continue;
    }

    for (const [, dep] of moduleData.dependencies) {
      const depPath = dep.absolutePath;
      const asyncType = dep.data?.data?.asyncType;

      // Only follow synchronous dependencies
      if (asyncType === 'async') {
        // oxlint-disable-next-line eslint/no-continue
        continue;
      }

      if (!coveredAbsPaths.has(depPath) && graph.has(depPath)) {
        missingAbsPaths.push(depPath);
      }

      if (!visited.has(depPath)) {
        pending.push(depPath);
      }
    }
  }

  return {
    valid: missingAbsPaths.length === 0,
    missingAbsPaths,
  };
}

/**
 * Assert that every runtime's completeness report passes. Throws a single
 * aggregated Error with up to 20 sample module paths per runtime. Called
 * from unionBuild.js after validateBundleCompleteness produced the reports;
 * centralizing the throw keeps the shape testable without wiring up the
 * whole union-build pipeline.
 */
function assertBundleCompleteness(reports) {
  const failures = reports.filter(({ result }) => !result.valid);
  if (failures.length === 0) return;
  const messages = failures.map(({ runtimeLabel, result }) => {
    const sample = result.missingAbsPaths.slice(0, 20);
    const extra =
      result.missingAbsPaths.length > 20
        ? `\n  ... and ${result.missingAbsPaths.length - 20} more`
        : '';
    const sampleBlock = sample.map((p) => `  - ${p}`).join('\n');
    return `[unionBuild] ${runtimeLabel} runtime: ${result.missingAbsPaths.length} module(s) reachable via sync edges but not in any eager bundle or segment — this will crash with "Requiring unknown module <N>" at runtime:\n${sampleBlock}${extra}`;
  });
  throw new Error(
    [
      'Split-bundle build is incomplete. Fix the allocator or add the module to',
      'apps/mobile/bundle-groups.config.js `promotedSegments` / `allocationRules`,',
      'or keep it in the eager bundle. Never silently continue.',
      'To temporarily downgrade to a warning for local experiments only, set',
      'ONEKEY_ALLOW_INCOMPLETE_BUNDLE=1 (never in CI / release builds).',
      'This gate is separate from ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK, which',
      'guards the post-HBC __d scan in check-split-bundle-integrity.js.',
      '',
      ...messages,
    ].join('\n'),
  );
}

/**
 * Expand each segment's module list to include transitive sync
 * dependencies that are NOT already in the eager bundle.
 *
 * Without this, a segment module can require() a sync dep that only
 * exists in the other runtime's eager bundle, causing a runtime crash.
 *
 * @param {Map<string, Array<[number, string]>>} segmentOutputs - from groupSerializedEntriesBySegment
 * @param {Array} serializedEntries - full serialized entries with moduleData
 * @param {Set<string>} eagerAbsPaths - absolute paths in the eager bundle for this runtime
 * @param {Map<number, string>} moduleIdToAbsPath - module ID → absolute path
 */
/**
 * Find sync deps of segment modules that are not in the eager bundle
 * and not in any segment, then add them to the first segment that needs them.
 *
 * This prevents "Requiring unknown module" crashes when a segment module
 * sync-requires a dep that only exists in the other runtime's bundle.
 *
 * Each missing dep is added to exactly ONE segment (the first that
 * references it), avoiding cross-segment duplication.
 */
function expandSegmentsWithSyncDeps({
  segmentOutputs,
  serializedEntries,
  eagerAbsPaths,
  moduleIdToAbsPath,
}) {
  const entryByAbsPath = new Map(
    serializedEntries.map((e) => [e.absolutePath, e]),
  );
  const moduleEntryByAbsPath = new Map(
    serializedEntries.map((e) => [e.absolutePath, [e.moduleId, e.moduleCode]]),
  );

  // All paths already covered by some segment in this runtime
  const coveredBySegment = new Set();
  for (const [, modules] of segmentOutputs) {
    for (const [moduleId] of modules) {
      const absPath = moduleIdToAbsPath.get(moduleId);
      if (absPath) {
        coveredBySegment.add(absPath);
      }
    }
  }

  let totalAdded = 0;

  for (const [, modules] of segmentOutputs) {
    const segAbsPaths = new Set();
    for (const [moduleId] of modules) {
      const absPath = moduleIdToAbsPath.get(moduleId);
      if (absPath) segAbsPaths.add(absPath);
    }

    const pending = [...segAbsPaths];
    const visited = new Set(segAbsPaths);

    while (pending.length > 0) {
      const absPath = pending.pop();
      const entry = entryByAbsPath.get(absPath);
      // oxlint-disable-next-line eslint/no-continue
      if (!entry?.moduleData) continue;

      for (const [, dep] of entry.moduleData.dependencies) {
        const depPath = dep.absolutePath;
        const asyncType = dep.data?.data?.asyncType;
        // oxlint-disable-next-line eslint/no-continue
        if (asyncType === 'async' || visited.has(depPath)) continue;
        visited.add(depPath);

        // Add if not in eager, not in any segment, and exists in serialized entries
        if (!eagerAbsPaths.has(depPath) && !coveredBySegment.has(depPath)) {
          const depModuleEntry = moduleEntryByAbsPath.get(depPath);
          if (depModuleEntry) {
            modules.push(depModuleEntry);
            coveredBySegment.add(depPath); // mark so other segments won't duplicate
            totalAdded += 1;
          }
        }

        pending.push(depPath);
      }
    }
  }

  return totalAdded;
}

/**
 * Collect segment keys that are async-imported by common-bundle (shared
 * startup) modules. These segments MUST be emitted as `runtime=shared` —
 * common code runs in both runtimes, so a runtime-specific variant would
 * be invisible to the other runtime, causing "segment missing from manifest".
 *
 * @param {Object} params
 * @param {Map<string, {dependencies: Map}>} params.mainGraph - main Metro graph
 * @param {Map<string, {dependencies: Map}>} params.backgroundGraph - bg Metro graph
 * @param {Set<string>} params.sharedStartupAbsPaths - eager common-bundle abs paths
 * @param {Map<string, Set<string>>} params.mainSegmentAbsPathsByKey
 * @param {Map<string, Set<string>>} params.backgroundSegmentAbsPathsByKey
 * @returns {Set<string>} segment keys that must be forced shared
 */
function collectCommonReferencedSegmentKeys({
  mainGraph,
  backgroundGraph,
  sharedStartupAbsPaths,
  mainSegmentAbsPathsByKey,
  backgroundSegmentAbsPathsByKey,
}) {
  const result = new Set();
  const allSegmentAbsPathsByKey = new Map([
    ...(mainSegmentAbsPathsByKey || new Map()),
    ...(backgroundSegmentAbsPathsByKey || new Map()),
  ]);
  for (const graph of [mainGraph, backgroundGraph]) {
    if (!graph || !graph.dependencies) {
      // eslint-disable-next-line no-continue
      continue;
    }
    for (const absolutePath of sharedStartupAbsPaths || []) {
      const mod = graph.dependencies.get(absolutePath);
      if (!mod) {
        // eslint-disable-next-line no-continue
        continue;
      }
      for (const [, dep] of mod.dependencies) {
        if (dep.data?.data?.asyncType === 'async') {
          for (const [segKey, absPaths] of allSegmentAbsPathsByKey) {
            if (absPaths.has(dep.absolutePath)) {
              result.add(segKey);
            }
          }
        }
      }
    }
  }
  return result;
}

module.exports = {
  assertBundleCompleteness,
  buildPostSection,
  buildSerializedModuleEntries,
  buildGraphModuleIndex,
  buildModuleSignature,
  buildRuntimeOwnership,
  collectCommonReferencedSegmentKeys,
  createAbsolutePathToSegmentMap,
  createSerializedModuleToSegmentMap,
  expandSegmentsWithSyncDeps,
  expandSyncDependencyClosure,
  groupSerializedEntriesBySegment,
  rewriteAsyncRequirePaths,
  seedSegmentAssignments,
  setEquals,
  validateBundleCompleteness,
};
