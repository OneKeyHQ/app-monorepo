const lodash = require('lodash');

const chromeManifest = require('./chrome');
const chromeManifestV3 = require('./chrome_v3');
const sharedManifest = require('./shared');

const browserManifest = process.env.EXT_MANIFEST_V3
  ? chromeManifestV3
  : chromeManifest;

const mergedManifest = lodash.merge(
  {
    manifest_version: 2,
  },
  sharedManifest,
  browserManifest,
);

// lodash merge array may cause be some bugs, so reassign `web_accessible_resources`
mergedManifest.web_accessible_resources =
  browserManifest.web_accessible_resources;

module.exports = mergedManifest;
