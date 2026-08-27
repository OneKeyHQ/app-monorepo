const path = require('path');

const SCHEMA_VERSION = 1;
const STRATEGY_VERSION = 1;

const fingerprintFiles = [
  'apps/mobile/babel.config.js',
  'apps/mobile/bundle-registry/module-id-registry.json',
  'apps/mobile/dev-vendor.config.js',
  'apps/mobile/metro.config.js',
  'apps/mobile/package.json',
  'apps/mobile/plugins/devVendor.js',
  'apps/mobile/plugins/index.js',
  'apps/mobile/plugins/map.js',
  'apps/mobile/plugins/moduleIdRegistry.js',
  'development/babelTools.js',
  'package.json',
  'yarn.lock',
];

module.exports = {
  SCHEMA_VERSION,
  STRATEGY_VERSION,
  commonBytecodeName: 'common.hbc',
  commonSourceMapName: 'common.js.map',
  commonSourceName: 'common.js',
  fingerprintDirectories: ['patches'],
  fingerprintFiles,
  isVendorModule(moduleKey) {
    return moduleKey.startsWith('node_modules/');
  },
  outputRoot(projectRoot) {
    return path.resolve(projectRoot, 'out-dir-bundle/dev-vendor');
  },
};
