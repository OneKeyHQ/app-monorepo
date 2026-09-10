const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ALLOCATION_VERSION,
  MODULE_ID_COLLISION_RESOLUTION_COMMAND,
  MODULE_ID_RANGES,
  REGISTRY_EPOCH,
  SCHEMA_VERSION,
} = require('../../apps/mobile/plugins/moduleIdRegistry');

const { checkModuleIdRegistry } = require('./module-id');

function writeRegistry(directory, modules) {
  const registryPath = path.join(directory, 'module-id-registry.json');
  fs.writeFileSync(
    registryPath,
    `${JSON.stringify({
      allocationVersion: ALLOCATION_VERSION,
      modules,
      ranges: MODULE_ID_RANGES,
      registryEpoch: REGISTRY_EPOCH,
      schemaVersion: SCHEMA_VERSION,
      tombstones: {},
    })}\n`,
  );
  return registryPath;
}

describe('module ID lint', () => {
  let temporaryDirectory;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-module-id-lint-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it('accepts unique module IDs', () => {
    const registryPath = writeRegistry(temporaryDirectory, {
      'packages/a.ts': 1,
      'packages/b.ts': 2,
    });

    expect(checkModuleIdRegistry(registryPath)).toEqual({
      activeModules: 2,
      tombstones: 0,
    });
  });

  it('rejects duplicate module IDs', () => {
    const registryPath = writeRegistry(temporaryDirectory, {
      'packages/a.ts': 1,
      'packages/b.ts': 1,
    });

    expect(() => checkModuleIdRegistry(registryPath)).toThrow(
      'Module ID 1 is assigned to both modules.packages/a.ts and modules.packages/b.ts',
    );
    expect(() => checkModuleIdRegistry(registryPath)).toThrow(
      MODULE_ID_COLLISION_RESOLUTION_COMMAND,
    );
  });
});
