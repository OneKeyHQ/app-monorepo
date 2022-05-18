const lodash = require('lodash');
const sharedManifest = require('./shared');
const chromeManifest = require('./chrome');
const chromeManifestV3 = require('./chrome_v3');
const firefoxManifest = require('./firefox');

let browserManifest = {};
if (process.env.EXT_CHANNEL === 'firefox') {
  browserManifest = firefoxManifest;
} else {
  // manifest v2
  browserManifest = chromeManifest;
  // manifest v3
  // browserManifest = chromeManifestV3;
}

module.exports = lodash.merge(
  {
    manifest_version: 2,
  },
  sharedManifest,
  browserManifest,
);
