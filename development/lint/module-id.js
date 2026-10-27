const {
  REGISTRY_PATH,
  loadRegistry,
} = require('../../apps/mobile/plugins/moduleIdRegistry');

function checkModuleIdRegistry(registryPath = REGISTRY_PATH) {
  const registry = loadRegistry(registryPath);
  return {
    activeModules: Object.keys(registry.modules).length,
    tombstones: Object.keys(registry.tombstones).length,
  };
}

function main() {
  try {
    const result = checkModuleIdRegistry();
    console.log(
      `[module-id] passed (${result.activeModules} active modules, ${result.tombstones} tombstones)`,
    );
  } catch (error) {
    console.error(`[module-id] failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkModuleIdRegistry,
};
