const isManifestV3 = Boolean(process.env.EXT_MANIFEST_V3);

const platforms = {
  all: 'all',
  app: 'app',
  desktop: 'desktop',
  ext: 'ext',
  web: 'web',
  webEmbed: 'webEmbed',
};
module.exports = {
  isManifestV3,
  platforms,
};
