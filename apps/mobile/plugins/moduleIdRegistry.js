const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 2;
const REGISTRY_EPOCH = 4;
const ALLOCATION_VERSION = 2;
const MODULE_ID_HASH_PROBE_LIMIT = 32;
const MODULE_ID_RANGES = Object.freeze({
  workspace: Object.freeze({ start: 0x00_01, end: 0x5f_ff }),
  nodeModules: Object.freeze({ start: 0x60_00, end: 0xef_ff }),
  virtual: Object.freeze({ start: 0xf0_00, end: 0xff_ff }),
});
const REPO_ROOT = path.resolve(__dirname, '../../..');
const REGISTRY_PATH = path.resolve(
  __dirname,
  '../bundle-registry/module-id-registry.json',
);
const UPDATE_HINT =
  'Run `yarn workspace @onekeyhq/mobile module-id:update --map <module-id-map.json>` and commit the registry update.';
const MODULE_ID_COLLISION_RESOLUTION_COMMAND =
  'yarn workspace @onekeyhq/mobile module-id:resolve-collisions';
const MODULE_ID_COLLISION_RESOLUTION_HINT = `Run \`${MODULE_ID_COLLISION_RESOLUTION_COMMAND}\` and commit the updated module ID registry.`;

function compareModuleKeys(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function normalizeStoredModuleKey(moduleKey) {
  if (typeof moduleKey !== 'string' || moduleKey.length === 0) {
    throw new Error('Module key must be a non-empty string.');
  }
  if (moduleKey.includes('\\')) {
    throw new Error(`Module key must use POSIX separators: ${moduleKey}`);
  }
  if (path.posix.isAbsolute(moduleKey)) {
    throw new Error(`Module key must not be absolute: ${moduleKey}`);
  }
  if (/^[a-zA-Z]:\//.test(moduleKey)) {
    throw new Error(`Module key must not contain a drive path: ${moduleKey}`);
  }
  const normalized = path.posix.normalize(moduleKey);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`Module key must stay inside the monorepo: ${moduleKey}`);
  }
  if (normalized !== moduleKey) {
    throw new Error(
      `Module key is not normalized (expected ${normalized}): ${moduleKey}`,
    );
  }
  return normalized;
}

function toModuleKey(filePath, repoRoot = REPO_ROOT) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('Module path must be a non-empty string.');
  }
  if (!path.isAbsolute(filePath)) {
    return normalizeStoredModuleKey(filePath.replaceAll('\\', '/'));
  }

  const normalizedRoot = path.resolve(repoRoot);
  const normalizedPath = path.resolve(filePath);
  const relativePath = path.relative(normalizedRoot, normalizedPath);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      `Module path is outside the monorepo root ${normalizedRoot}: ${normalizedPath}`,
    );
  }
  return normalizeStoredModuleKey(relativePath.split(path.sep).join('/'));
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function getMaxModuleId(moduleIds) {
  let maxModuleId = 0;
  for (const moduleId of moduleIds) {
    if (moduleId > maxModuleId) maxModuleId = moduleId;
  }
  return maxModuleId;
}

function getModuleIdDomain(moduleKey) {
  const normalizedModuleKey = normalizeStoredModuleKey(moduleKey);
  if (
    normalizedModuleKey.startsWith('\0') ||
    normalizedModuleKey === '__prelude__'
  ) {
    return 'virtual';
  }
  if (normalizedModuleKey.split('/').includes('node_modules')) {
    return 'nodeModules';
  }
  return 'workspace';
}

function isModuleIdInDomain(moduleId, domain) {
  const range = MODULE_ID_RANGES[domain];
  return Boolean(range && moduleId >= range.start && moduleId <= range.end);
}

function hashModuleIdParts(parts) {
  const hash = crypto.createHash('sha256');
  for (const part of parts) {
    hash.update(String(part));
    hash.update('\0');
  }
  return hash.digest().readUInt32BE(0);
}

function createModuleIdAllocator(moduleIds) {
  const usedIds = moduleIds instanceof Set ? moduleIds : new Set(moduleIds);

  return (domain, moduleKey) => {
    const range = MODULE_ID_RANGES[domain];
    if (!range) {
      throw new Error(`Unknown module ID domain: ${String(domain)}.`);
    }
    if (typeof moduleKey !== 'string' || moduleKey.length === 0) {
      throw new Error('Module allocation key must be a non-empty string.');
    }

    const rangeSize = range.end - range.start + 1;
    for (let probe = 0; probe < MODULE_ID_HASH_PROBE_LIMIT; probe += 1) {
      const moduleId =
        range.start +
        (hashModuleIdParts(['onekey-module-id-v2', domain, moduleKey, probe]) %
          rangeSize);
      if (!usedIds.has(moduleId)) {
        usedIds.add(moduleId);
        return moduleId;
      }
    }

    // The hash probes handle normal occupancy; this scan guarantees exhaustion is exact.
    const fallbackOffset =
      hashModuleIdParts(['onekey-module-id-v2-fallback', domain, moduleKey]) %
      rangeSize;
    for (let scan = 0; scan < rangeSize; scan += 1) {
      const moduleId = range.start + ((fallbackOffset + scan) % rangeSize);
      if (!usedIds.has(moduleId)) {
        usedIds.add(moduleId);
        return moduleId;
      }
    }

    throw new Error(
      `Module ID range exhausted for ${domain}: ${range.start}-${range.end}.`,
    );
  };
}

function collectRegistryErrors(
  registry,
  { allowDuplicateIds = false, allowOutOfDomainIds = false } = {},
) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['Registry must be a JSON object.'];
  }
  if (registry.schemaVersion !== SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${SCHEMA_VERSION}, received ${String(
        registry.schemaVersion,
      )}.`,
    );
  }
  if (registry.registryEpoch !== REGISTRY_EPOCH) {
    errors.push(
      `registryEpoch must be ${REGISTRY_EPOCH}, received ${String(
        registry.registryEpoch,
      )}.`,
    );
  }
  if (registry.allocationVersion !== ALLOCATION_VERSION) {
    errors.push(
      `allocationVersion must be ${ALLOCATION_VERSION}, received ${String(
        registry.allocationVersion,
      )}.`,
    );
  }
  if (
    !registry.ranges ||
    typeof registry.ranges !== 'object' ||
    Array.isArray(registry.ranges)
  ) {
    errors.push('ranges must be an object.');
  } else {
    const actualDomains = Object.keys(registry.ranges);
    const expectedDomains = Object.keys(MODULE_ID_RANGES);
    if (
      actualDomains.length !== expectedDomains.length ||
      expectedDomains.some((domain) => !actualDomains.includes(domain))
    ) {
      errors.push(`ranges must define exactly: ${expectedDomains.join(', ')}.`);
    }
    for (const [domain, expectedRange] of Object.entries(MODULE_ID_RANGES)) {
      const actualRange = registry.ranges[domain];
      if (
        !actualRange ||
        typeof actualRange !== 'object' ||
        Array.isArray(actualRange) ||
        actualRange.start !== expectedRange.start ||
        actualRange.end !== expectedRange.end
      ) {
        errors.push(
          `ranges.${domain} must be ${expectedRange.start}-${expectedRange.end}.`,
        );
      }
    }
  }

  const modules = registry.modules;
  const tombstones = registry.tombstones;
  if (!modules || typeof modules !== 'object' || Array.isArray(modules)) {
    errors.push('modules must be an object.');
  }
  if (
    !tombstones ||
    typeof tombstones !== 'object' ||
    Array.isArray(tombstones)
  ) {
    errors.push('tombstones must be an object.');
  }
  if (errors.some((error) => error.endsWith('must be an object.'))) {
    return errors;
  }

  const usedIds = new Map();
  const activePaths = new Set(Object.keys(modules));
  for (const [sectionName, entries] of [
    ['modules', modules],
    ['tombstones', tombstones],
  ]) {
    const keys = Object.keys(entries);
    const sortedKeys = keys.toSorted();
    if (keys.some((key, index) => key !== sortedKeys[index])) {
      errors.push(`${sectionName} keys must be sorted.`);
    }
    for (const [moduleKey, moduleId] of Object.entries(entries)) {
      let normalizedModuleKey;
      try {
        normalizedModuleKey = normalizeStoredModuleKey(moduleKey);
      } catch (error) {
        errors.push(`${sectionName}.${moduleKey}: ${error.message}`);
      }
      if (!isPositiveSafeInteger(moduleId)) {
        errors.push(
          `${sectionName}.${moduleKey} must have a positive safe integer ID.`,
        );
      } else {
        if (normalizedModuleKey) {
          const domain = getModuleIdDomain(normalizedModuleKey);
          if (!allowOutOfDomainIds && !isModuleIdInDomain(moduleId, domain)) {
            const range = MODULE_ID_RANGES[domain];
            errors.push(
              `${sectionName}.${moduleKey} ID ${moduleId} must be in the ${domain} range ${range.start}-${range.end}.`,
            );
          }
        }
        const previous = usedIds.get(moduleId);
        if (previous && !allowDuplicateIds) {
          errors.push(
            `Module ID ${moduleId} is assigned to both ${previous} and ${sectionName}.${moduleKey}.`,
          );
        } else if (!previous) {
          usedIds.set(moduleId, `${sectionName}.${moduleKey}`);
        }
      }
      if (sectionName === 'tombstones' && activePaths.has(moduleKey)) {
        errors.push(`Module key is both active and tombstoned: ${moduleKey}.`);
      }
    }
  }
  return errors;
}

function assertValidRegistry(registry, options) {
  const errors = collectRegistryErrors(registry, options);
  if (errors.length > 0) {
    const collisionHint = errors.some((error) => error.startsWith('Module ID '))
      ? `\n\n${MODULE_ID_COLLISION_RESOLUTION_HINT}`
      : '';
    throw new Error(
      `Invalid module ID registry:\n- ${errors.join('\n- ')}${collisionHint}`,
    );
  }
  return registry;
}

function loadRegistry(registryPath = REGISTRY_PATH) {
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to load module ID registry at ${registryPath}: ${error.message}`,
      { cause: error },
    );
  }
  return assertValidRegistry(registry);
}

function isStrictRegistryMode(env = process.env) {
  const override = env.ONEKEY_MODULE_ID_REGISTRY_STRICT;
  if (override === 'true') return true;
  if (override === 'false') return false;
  if (override !== undefined) {
    throw new Error(
      'ONEKEY_MODULE_ID_REGISTRY_STRICT must be either "true" or "false".',
    );
  }
  return env.UNION_BUILD === 'true' || env.NODE_ENV === 'production';
}

function createFileToIdMap({
  registry = loadRegistry(),
  repoRoot = REPO_ROOT,
  strict = isStrictRegistryMode(),
} = {}) {
  assertValidRegistry(registry);
  const registeredIds = new Map(Object.entries(registry.modules));
  const usedIds = new Set([
    ...Object.values(registry.modules),
    ...Object.values(registry.tombstones),
  ]);
  const observedPaths = new Map();
  const ephemeralIds = new Map();
  const allocateModuleId = createModuleIdAllocator(usedIds);

  const getObservedPath = (filePath) =>
    path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(repoRoot, filePath);

  const getEphemeralDomain = (filePath, moduleKey) => {
    if (moduleKey) return getModuleIdDomain(moduleKey);
    return filePath.split(path.sep).includes('node_modules')
      ? 'nodeModules'
      : 'workspace';
  };

  const allocateEphemeralId = (filePath, moduleKey) => {
    const observedPath = getObservedPath(filePath);
    const existingId = ephemeralIds.get(observedPath);
    if (existingId !== undefined) {
      observedPaths.set(observedPath, existingId);
      return existingId;
    }
    const moduleId = allocateModuleId(
      getEphemeralDomain(filePath, moduleKey),
      moduleKey || observedPath.split(path.sep).join('/'),
    );
    ephemeralIds.set(observedPath, moduleId);
    observedPaths.set(observedPath, moduleId);
    return moduleId;
  };

  const get = (filePath) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return undefined;
    }
    let moduleKey;
    try {
      moduleKey = toModuleKey(filePath, repoRoot);
    } catch (error) {
      if (strict) {
        throw new Error(`${error.message} ${UPDATE_HINT}`, { cause: error });
      }
      return allocateEphemeralId(filePath);
    }
    const registeredId = registeredIds.get(moduleKey);
    if (registeredId !== undefined) {
      observedPaths.set(getObservedPath(filePath), registeredId);
      return registeredId;
    }
    if (strict) {
      throw new Error(
        `Module is not registered in ${REGISTRY_PATH}: ${moduleKey}. ${UPDATE_HINT}`,
      );
    }
    return allocateEphemeralId(filePath, moduleKey);
  };

  return {
    has: (filePath) => observedPaths.has(getObservedPath(filePath)),
    safeSet: get,
    set: (filePath, moduleId) => {
      if (!isPositiveSafeInteger(moduleId)) {
        throw new Error(
          `Module ID must be a positive safe integer: ${moduleId}`,
        );
      }
      const observedPath = getObservedPath(filePath);
      let registeredId;
      let moduleKey;
      try {
        moduleKey = toModuleKey(filePath, repoRoot);
        registeredId = registeredIds.get(moduleKey);
      } catch {
        registeredId = undefined;
      }
      if (registeredId !== undefined) {
        if (registeredId !== moduleId) {
          throw new Error(
            `Registered module path ${observedPath} must use ID ${registeredId}, received ${moduleId}.`,
          );
        }
        observedPaths.set(observedPath, moduleId);
        return;
      }
      const domain = getEphemeralDomain(filePath, moduleKey);
      if (!isModuleIdInDomain(moduleId, domain)) {
        const range = MODULE_ID_RANGES[domain];
        throw new Error(
          `Module ID ${moduleId} for ${observedPath} must be in the ${domain} range ${range.start}-${range.end}.`,
        );
      }
      const existingId = observedPaths.get(observedPath);
      if (existingId !== undefined && existingId !== moduleId) {
        throw new Error(
          `Module path ${observedPath} is already assigned ID ${existingId}.`,
        );
      }
      if (usedIds.has(moduleId) && existingId !== moduleId) {
        throw new Error(`Module ID ${moduleId} is already reserved.`);
      }
      observedPaths.set(observedPath, moduleId);
      usedIds.add(moduleId);
    },
    get,
    delete: (filePath) => observedPaths.delete(getObservedPath(filePath)),
    entries: () => observedPaths.entries(),
    size: () => observedPaths.size,
  };
}

module.exports = {
  ALLOCATION_VERSION,
  MODULE_ID_COLLISION_RESOLUTION_COMMAND,
  MODULE_ID_COLLISION_RESOLUTION_HINT,
  MODULE_ID_HASH_PROBE_LIMIT,
  MODULE_ID_RANGES,
  REGISTRY_EPOCH,
  REGISTRY_PATH,
  REPO_ROOT,
  SCHEMA_VERSION,
  UPDATE_HINT,
  assertValidRegistry,
  collectRegistryErrors,
  compareModuleKeys,
  createFileToIdMap,
  createModuleIdAllocator,
  getMaxModuleId,
  getModuleIdDomain,
  isModuleIdInDomain,
  isPositiveSafeInteger,
  isStrictRegistryMode,
  loadRegistry,
  normalizeStoredModuleKey,
  toModuleKey,
};
