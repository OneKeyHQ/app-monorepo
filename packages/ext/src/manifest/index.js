const sharedManifest = require('./shared');
const firefoxManifest = require('./firefox');
const chromeManifest = require('./chrome');

let browserManifest = {};
if (process.env.EXT_BUILD_BROWSER === 'firefox') {
  browserManifest = firefoxManifest;
} else {
  browserManifest = chromeManifest;
}

module.exports = {
  ...sharedManifest,
  ...browserManifest,
};
