#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  ALLOCATION_VERSION,
  MODULE_ID_RANGES,
  REGISTRY_EPOCH,
  REGISTRY_PATH,
  REPO_ROOT,
  SCHEMA_VERSION,
  assertValidRegistry,
  collectRegistryErrors,
  compareModuleKeys,
  createModuleIdAllocator,
  getModuleIdDomain,
  isModuleIdInDomain,
  isPositiveSafeInteger,
  loadRegistry,
  toModuleKey,
} = require('../plugins/moduleIdRegistry');

const MOBILE_DIR = path.resolve(__dirname, '..');
const REGISTRY_REPO_PATH = path
  .relative(REPO_ROOT, REGISTRY_PATH)
  .split(path.sep)
  .join('/');

function createEmptyRegistry() {
  return {
    schemaVersion: SCHEMA_VERSION,
    registryEpoch: REGISTRY_EPOCH,
    allocationVersion: ALLOCATION_VERSION,
    ranges: MODULE_ID_RANGES,
    modules: {},
    tombstones: {},
  };
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).toSorted(([first], [second]) =>
      compareModuleKeys(first, second),
    ),
  );
}

function canonicalizeRegistry(registry) {
  return {
    schemaVersion: registry.schemaVersion,
    registryEpoch: registry.registryEpoch,
    allocationVersion: registry.allocationVersion,
    ranges: registry.ranges,
    modules: sortRecord(registry.modules),
    tombstones: sortRecord(registry.tombstones),
  };
}

function writeRegistry(registry, registryPath = REGISTRY_PATH) {
  assertValidRegistry(registry);
  const canonical = canonicalizeRegistry(registry);
  assertValidRegistry(canonical);
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(canonical, null, 2)}\n`);
}

function readRegistryForUpdate(registryPath = REGISTRY_PATH) {
  if (!fs.existsSync(registryPath)) return createEmptyRegistry();
  return loadRegistry(registryPath);
}

function collectModuleMapEntries(moduleMap, repoRoot = REPO_ROOT) {
  if (!moduleMap || typeof moduleMap !== 'object' || Array.isArray(moduleMap)) {
    throw new Error('Module ID map must be a JSON object.');
  }
  const entries = [];
  const appendBucket = (bucketName, bucket) => {
    if (bucket === undefined) return;
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) {
      throw new Error(`${bucketName} must be an object.`);
    }
    for (const [rawId, filePath] of Object.entries(bucket)) {
      const moduleId = Number(rawId);
      if (!isPositiveSafeInteger(moduleId) || String(moduleId) !== rawId) {
        throw new Error(`${bucketName} has an invalid module ID: ${rawId}.`);
      }
      if (typeof filePath !== 'string') {
        throw new Error(`${bucketName}.${rawId} must be a module path string.`);
      }
      entries.push({
        bucket: bucketName,
        moduleId,
        moduleKey: toModuleKey(filePath, repoRoot),
      });
    }
  };

  for (const bucketName of ['common', 'main', 'background', 'eager']) {
    appendBucket(bucketName, moduleMap[bucketName]);
  }
  if (moduleMap.segments !== undefined) {
    if (
      !moduleMap.segments ||
      typeof moduleMap.segments !== 'object' ||
      Array.isArray(moduleMap.segments)
    ) {
      throw new Error('segments must be an object.');
    }
    for (const [segmentName, segment] of Object.entries(moduleMap.segments)) {
      if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
        throw new Error(`segments.${segmentName} must be an object.`);
      }
      appendBucket(`segments.${segmentName}.modules`, segment.modules);
    }
  }
  return entries;
}

function updateRegistry(registry, moduleMaps, repoRoot = REPO_ROOT) {
  assertValidRegistry(registry);
  const moduleKeys = new Set();
  for (const moduleMap of moduleMaps) {
    for (const { moduleKey } of collectModuleMapEntries(moduleMap, repoRoot)) {
      moduleKeys.add(moduleKey);
    }
  }

  return updateRegistryFromModuleKeys(registry, moduleKeys);
}

function updateRegistryFromModulePaths(
  registry,
  modulePaths,
  repoRoot = REPO_ROOT,
) {
  const moduleKeys = new Set(
    [...modulePaths].map((modulePath) => toModuleKey(modulePath, repoRoot)),
  );
  return updateRegistryFromModuleKeys(registry, moduleKeys);
}

function updateRegistryFromModuleKeys(registry, moduleKeys) {
  assertValidRegistry(registry);

  const modules = { ...registry.modules };
  const tombstones = { ...registry.tombstones };
  const reservedIds = [...Object.values(modules), ...Object.values(tombstones)];
  const allocateModuleId = createModuleIdAllocator(reservedIds);
  let added = 0;
  for (const moduleKey of [...moduleKeys].toSorted()) {
    if (Object.hasOwn(tombstones, moduleKey)) {
      throw new Error(
        `Tombstoned module reappeared and must be reviewed explicitly: ${moduleKey}.`,
      );
    }
    if (!Object.hasOwn(modules, moduleKey)) {
      modules[moduleKey] = allocateModuleId(
        getModuleIdDomain(moduleKey),
        moduleKey,
      );
      added += 1;
    }
  }
  const updatedRegistry = canonicalizeRegistry({
    ...registry,
    modules,
    tombstones,
  });
  assertValidRegistry(updatedRegistry);
  return { registry: updatedRegistry, added };
}

function reallocateRegistry(registry) {
  const sourceRegistry = {
    ...registry,
    allocationVersion: ALLOCATION_VERSION,
    ranges: MODULE_ID_RANGES,
    registryEpoch: REGISTRY_EPOCH,
    schemaVersion: SCHEMA_VERSION,
  };
  const sourceErrors = collectRegistryErrors(sourceRegistry, {
    allowDuplicateIds: true,
    allowOutOfDomainIds: true,
  });
  if (sourceErrors.length > 0) {
    throw new Error(
      `Unable to reallocate invalid module ID registry:\n- ${sourceErrors.join(
        '\n- ',
      )}`,
    );
  }

  const entries = ['modules', 'tombstones']
    .flatMap((sectionName) =>
      Object.keys(sourceRegistry[sectionName]).map((moduleKey) => ({
        moduleKey,
        sectionName,
      })),
    )
    .toSorted((first, second) =>
      compareModuleKeys(first.moduleKey, second.moduleKey),
    );
  const reallocated = {
    ...sourceRegistry,
    modules: {},
    tombstones: {},
  };
  const allocateModuleId = createModuleIdAllocator([]);
  for (const { moduleKey, sectionName } of entries) {
    reallocated[sectionName][moduleKey] = allocateModuleId(
      getModuleIdDomain(moduleKey),
      moduleKey,
    );
  }

  const canonical = canonicalizeRegistry(reallocated);
  assertValidRegistry(canonical);
  return canonical;
}

function checkModuleMaps(registry, moduleMaps, repoRoot = REPO_ROOT) {
  const errors = [...collectRegistryErrors(registry)];
  if (errors.length > 0) return errors;
  for (const { mapPath, moduleMap } of moduleMaps) {
    let entries;
    try {
      entries = collectModuleMapEntries(moduleMap, repoRoot);
    } catch (error) {
      errors.push(`${mapPath}: ${error.message}`);
    }
    if (entries) {
      for (const { bucket, moduleId, moduleKey } of entries) {
        const registeredId = registry.modules[moduleKey];
        if (registeredId === undefined) {
          errors.push(`${mapPath}:${bucket} is not registered: ${moduleKey}.`);
        } else if (registeredId !== moduleId) {
          errors.push(
            `${mapPath}:${bucket} ID mismatch for ${moduleKey}: registry=${registeredId}, map=${moduleId}.`,
          );
        }
      }
    }
  }
  return errors;
}

function reconcileRegistries(baseRegistry, currentRegistry) {
  assertValidRegistry(baseRegistry);
  const currentErrors = collectRegistryErrors(currentRegistry, {
    allowDuplicateIds: true,
    allowOutOfDomainIds: true,
  });
  if (currentErrors.length > 0) {
    throw new Error(
      `Invalid current module ID registry:\n- ${currentErrors.join('\n- ')}`,
    );
  }

  for (const sectionName of ['modules', 'tombstones']) {
    const oppositeSection =
      sectionName === 'modules' ? 'tombstones' : 'modules';
    for (const [moduleKey, moduleId] of Object.entries(
      baseRegistry[sectionName],
    )) {
      if (currentRegistry[oppositeSection][moduleKey] !== undefined) {
        throw new Error(
          `Base ${sectionName} entry changed state: ${moduleKey} (${moduleId}).`,
        );
      }
      if (currentRegistry[sectionName][moduleKey] !== moduleId) {
        throw new Error(
          `Base ${sectionName} entry changed or was removed: ${moduleKey} (${moduleId}).`,
        );
      }
    }
  }

  const basePaths = new Set([
    ...Object.keys(baseRegistry.modules),
    ...Object.keys(baseRegistry.tombstones),
  ]);
  const usedIds = new Set([
    ...Object.values(baseRegistry.modules),
    ...Object.values(baseRegistry.tombstones),
  ]);
  const pending = [];
  const newEntries = [];
  for (const sectionName of ['modules', 'tombstones']) {
    for (const [moduleKey, moduleId] of Object.entries(
      currentRegistry[sectionName],
    )) {
      if (!basePaths.has(moduleKey)) {
        newEntries.push({ moduleKey, moduleId, sectionName });
      }
    }
  }
  const sortedNewEntries = newEntries.toSorted((first, second) =>
    compareModuleKeys(first.moduleKey, second.moduleKey),
  );

  for (const entry of sortedNewEntries) {
    const domain = getModuleIdDomain(entry.moduleKey);
    if (
      usedIds.has(entry.moduleId) ||
      !isModuleIdInDomain(entry.moduleId, domain)
    ) {
      pending.push(entry);
    } else {
      usedIds.add(entry.moduleId);
    }
  }

  const reconciled = {
    ...currentRegistry,
    modules: { ...currentRegistry.modules },
    tombstones: { ...currentRegistry.tombstones },
  };
  const allocateModuleId = createModuleIdAllocator(usedIds);
  for (const entry of pending) {
    reconciled[entry.sectionName][entry.moduleKey] = allocateModuleId(
      getModuleIdDomain(entry.moduleKey),
      entry.moduleKey,
    );
  }

  const canonical = canonicalizeRegistry(reconciled);
  assertValidRegistry(canonical);
  return { registry: canonical, reassigned: pending.length };
}

function parseArgs(argv) {
  const command = argv[0];
  if (
    !['update', 'check', 'reconcile', 'resolve-collisions'].includes(command)
  ) {
    throw new Error(
      'Usage: module-id-registry.js <update|check|reconcile|resolve-collisions> [options]',
    );
  }
  const mapPaths = [];
  let base;
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--map') {
      const value = argv[index + 1];
      if (!value) throw new Error('--map requires a path.');
      mapPaths.push(path.resolve(value));
      index += 1;
    } else if (arg === '--base') {
      base = argv[index + 1];
      if (!base) throw new Error('--base requires a git ref.');
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}.`);
    }
  }
  if (command === 'reconcile' && !base) {
    throw new Error('reconcile requires --base <git ref>.');
  }
  if (!['reconcile', 'resolve-collisions'].includes(command) && base) {
    throw new Error(
      '--base is only valid with reconcile or resolve-collisions.',
    );
  }
  if (
    ['reconcile', 'resolve-collisions'].includes(command) &&
    mapPaths.length > 0
  ) {
    throw new Error('--map is not valid with collision resolution commands.');
  }
  return { base, command, mapPaths };
}

function findDefaultMapPaths() {
  const candidates = [
    path.join(MOBILE_DIR, 'dist/module-id-map.json'),
    path.join(MOBILE_DIR, 'dist/module-id-map-main.json'),
    path.join(MOBILE_DIR, 'dist/module-id-map-background.json'),
    path.join(MOBILE_DIR, 'out-dir-bundle/ios/dist/module-id-map.json'),
    path.join(MOBILE_DIR, 'out-dir-bundle/android/dist/module-id-map.json'),
  ];
  return [
    ...new Set(candidates.filter((candidate) => fs.existsSync(candidate))),
  ];
}

function readModuleMaps(mapPaths) {
  return mapPaths.map((mapPath) => {
    let moduleMap;
    try {
      moduleMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    } catch (error) {
      throw new Error(
        `Unable to read module ID map ${mapPath}: ${error.message}`,
        { cause: error },
      );
    }
    return { mapPath, moduleMap };
  });
}

function readBaseRegistry(base) {
  let contents;
  try {
    contents = execFileSync('git', ['show', `${base}:${REGISTRY_REPO_PATH}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(
      `Unable to read registry from ${base}:${REGISTRY_REPO_PATH}: ${detail}`,
      { cause: error },
    );
  }
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Base registry is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
}

function findCollisionResolutionBase(currentRegistry) {
  const candidates = [];
  try {
    candidates.push(
      execFileSync('git', ['rev-parse', '--verify', 'origin/x^{commit}'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    );
  } catch {
    // Local-only repositories can still resolve against their first-parent history.
  }
  try {
    candidates.push(
      ...execFileSync(
        'git',
        [
          'rev-list',
          '--first-parent',
          '--max-count=100',
          'HEAD',
          '--',
          REGISTRY_REPO_PATH,
        ],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
        .trim()
        .split('\n')
        .filter(Boolean),
    );
  } catch {
    // The actionable error below also covers unavailable git history.
  }

  for (const baseRef of new Set(candidates)) {
    try {
      const result = reconcileRegistries(
        readBaseRegistry(baseRef),
        currentRegistry,
      );
      return { baseRef, result };
    } catch {
      // Keep searching for the closest valid registry ancestor.
    }
  }
  throw new Error(
    'Unable to find a valid collision-resolution base automatically. Pass --base <git ref> for a valid registry ancestor.',
  );
}

function run(argv = process.argv.slice(2)) {
  const { base, command, mapPaths } = parseArgs(argv);
  if (['reconcile', 'resolve-collisions'].includes(command)) {
    const currentRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    if (
      command === 'resolve-collisions' &&
      collectRegistryErrors(currentRegistry).length === 0
    ) {
      console.log(
        `[module-id:resolve-collisions] ${REGISTRY_REPO_PATH} is valid; no collisions to resolve.`,
      );
      return;
    }
    const resolution = base
      ? {
          baseRef: base,
          result: reconcileRegistries(readBaseRegistry(base), currentRegistry),
        }
      : findCollisionResolutionBase(currentRegistry);
    const { result } = resolution;
    writeRegistry(result.registry);
    console.log(
      `[module-id:${command}] wrote ${REGISTRY_REPO_PATH}; base ${resolution.baseRef}; reassigned ${result.reassigned} new collision(s).`,
    );
    return;
  }

  const resolvedMapPaths =
    mapPaths.length > 0 ? mapPaths : findDefaultMapPaths();
  if (command === 'update' && resolvedMapPaths.length === 0) {
    throw new Error(
      'No module ID maps found. Pass one or more --map <module-id-map.json> options.',
    );
  }
  const moduleMaps = readModuleMaps(resolvedMapPaths);
  if (command === 'update') {
    const result = updateRegistry(
      readRegistryForUpdate(),
      moduleMaps.map(({ moduleMap }) => moduleMap),
    );
    writeRegistry(result.registry);
    console.log(
      `[module-id:update] wrote ${REGISTRY_REPO_PATH}; ${
        Object.keys(result.registry.modules).length
      } active modules, ${result.added} added.`,
    );
    return;
  }

  const registry = loadRegistry();
  const errors = checkModuleMaps(registry, moduleMaps);
  if (errors.length > 0) {
    const displayedErrors = errors.slice(0, 100);
    const remainingCount = errors.length - displayedErrors.length;
    const remainingMessage =
      remainingCount > 0
        ? `\n- ... ${remainingCount} additional error(s) omitted.`
        : '';
    const mismatchMessage = errors.some((error) =>
      error.includes('ID mismatch'),
    )
      ? '\nLegacy traversal-ID maps may seed `module-id:update`, but `module-id:check --map` requires a fresh registry-backed build map.'
      : '';
    throw new Error(
      `Module ID registry check failed:\n- ${displayedErrors.join(
        '\n- ',
      )}${remainingMessage}${mismatchMessage}`,
    );
  }
  console.log(
    `[module-id:check] OK; ${
      Object.keys(registry.modules).length
    } active modules, ${Object.keys(registry.tombstones).length} tombstones, ${
      moduleMaps.length
    } build map(s) checked.`,
  );
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`[module-id] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  canonicalizeRegistry,
  checkModuleMaps,
  collectModuleMapEntries,
  createEmptyRegistry,
  findDefaultMapPaths,
  parseArgs,
  reallocateRegistry,
  reconcileRegistries,
  run,
  updateRegistry,
  updateRegistryFromModulePaths,
  writeRegistry,
};
