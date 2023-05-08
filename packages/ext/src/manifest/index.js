const lodash = require('lodash');
const sharedManifest = require('./shared');
const chromeManifest = require('./chrome');
const chromeManifestV3 = require('./chrome_v3');
const firefoxManifest = require('./firefox');

let browserManifest = {};
if (process.env.EXT_CHANNEL === 'firefox') {
  browserManifest = firefoxManifest;
} else if (process.env.EXT_MANIFEST_V3) {
  // manifest v3
  browserManifest = chromeManifestV3;
} else {
  // manifest v2
  browserManifest = chromeManifest;
}

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
