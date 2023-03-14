const devUtils = require('./devUtils');

const buildTargetBrowser = devUtils.getBuildTargetBrowser();

const portMap = {
  'chrome': {
    // 3000 is used for web, 3001 is used for desktop
    dev: 3100,
    sourcemap: 31317,
  },
  'firefox': {
    dev: 3101,
    sourcemap: 31318,
  },
  'edge': {
    dev: 3102,
    sourcemap: 31319,
  },
};

function getDevServerPort() {
  return portMap[buildTargetBrowser].dev;
}

function getSourceMapServerPort() {
  return portMap[buildTargetBrowser].sourcemap;
}

module.exports = {
  getDevServerPort,
  getSourceMapServerPort,
};
