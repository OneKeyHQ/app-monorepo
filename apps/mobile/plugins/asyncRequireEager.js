const asyncRequire = require('metro-runtime/src/modules/asyncRequire');

// Preserve the async boundary used by the split wrapper for circular imports.
module.exports = Object.assign(async (moduleId, paths) => {
  await Promise.resolve();
  return asyncRequire(moduleId, paths);
}, asyncRequire);
