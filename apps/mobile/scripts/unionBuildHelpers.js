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

  const sharedStartupAbsPaths = new Set(
    [...sharedEquivalentAbsPaths].filter(
      (absolutePath) =>
        mainReachable.has(absolutePath) && bgReachable.has(absolutePath),
    ),
  );
  const mainStartupAbsPaths = new Set(
    [...mainReachable].filter(
      (absolutePath) => !sharedStartupAbsPaths.has(absolutePath),
    ),
  );
  const bgStartupAbsPaths = new Set(
    [...bgReachable].filter(
      (absolutePath) => !sharedStartupAbsPaths.has(absolutePath),
    ),
  );

  return {
    allAbsPaths,
    sharedEquivalentAbsPaths,
    sharedStartupAbsPaths,
    mainStartupAbsPaths,
    bgStartupAbsPaths,
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

function rewriteAsyncRequirePaths(wrappedModules, moduleToSegment) {
  if (!moduleToSegment || moduleToSegment.size === 0) {
    return;
  }

  const asyncModuleIds = [...moduleToSegment.keys()];
  if (asyncModuleIds.length === 0) {
    return;
  }

  const idAlternation = asyncModuleIds.map(String).join('|');
  const pattern = new RegExp(
    `([{,]\\s*)"(${idAlternation})"(\\s*:\\s*)"[^"]*"`,
    'g',
  );

  for (const wrappedModule of wrappedModules) {
    if (typeof wrappedModule[1] === 'string') {
      wrappedModule[1] = wrappedModule[1].replace(
        pattern,
        (_, prefix, moduleId, colon) => {
          const segmentKey = moduleToSegment.get(Number(moduleId));
          return segmentKey
            ? `${prefix}"${moduleId}"${colon}"${segmentKey}"`
            : _;
        },
      );
    }
  }
}

module.exports = {
  buildGraphModuleIndex,
  buildModuleSignature,
  buildRuntimeOwnership,
  createAbsolutePathToSegmentMap,
  createSerializedModuleToSegmentMap,
  rewriteAsyncRequirePaths,
  setEquals,
};
