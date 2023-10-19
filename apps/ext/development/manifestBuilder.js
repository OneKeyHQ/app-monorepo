function buildManifest(content, filePath) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  const manifest = require('../src/manifest/index');
  // generates the manifest file using the package.json informations
  return Buffer.from(JSON.stringify(manifest, null, 2));
}

module.exports = {
  buildManifest,
};
