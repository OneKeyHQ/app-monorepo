const httpServer = require('http-server');
const devUtils = require('./devUtils');
const serverPort = require('./serverPort');

const buildTargetBrowser = devUtils.getBuildTargetBrowser();

const port = serverPort.getSourceMapServerPort();

function start() {
  // Start stand-alone sourcemap file server: http://127.0.0.1:31317
  const server = httpServer.createServer({
    root: `./build/${buildTargetBrowser}`,
  });
  console.log('>>>>>>>>   Sourcemap Server Start: ');
  console.log(`   http://127.0.0.1:${port}`);
  server.listen(port, null);
}

module.exports = {
  start,
  port,
};
