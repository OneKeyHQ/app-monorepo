const devUtils = require('./devUtils');

const buildTargetBrowser = devUtils.getBuildTargetBrowser();
const manifestV3Flag = devUtils.isManifestV3() ? '_v3' : '';
const portMapKey = buildTargetBrowser + manifestV3Flag;

const portMap = {
  'chrome': {
    // 3000 is used for web, 3001 is used for desktop
    dev: 3100,
    sourcemap: 31317,
  },
  'chrome_v3': {
    // 3000 is used for web, 3001 is used for desktop
    dev: 3180,
    sourcemap: 31387,
  },

  'firefox': {
    dev: 3101,
    sourcemap: 31318,
  },
  'firefox_v3': {
    dev: 3181,
    sourcemap: 31388,
  },

  'edge': {
    dev: 3102,
    sourcemap: 31319,
  },
  'edge_v3': {
    dev: 3182,
    sourcemap: 31389,
  },
};

function getDevServerPort() {
  return portMap[portMapKey].dev;
}

function getSourceMapServerPort() {
  return portMap[portMapKey].sourcemap;
}

module.exports = {
  getDevServerPort,
  getSourceMapServerPort,
};
