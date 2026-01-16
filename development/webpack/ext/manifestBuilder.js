function buildManifest(content, filePath) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const manifest = require('../../../apps/ext/src/manifest');
  // generates the manifest file using the package.json information
  return Buffer.from(JSON.stringify(manifest, null, 2));
}

module.exports = {
  buildManifest,
};
