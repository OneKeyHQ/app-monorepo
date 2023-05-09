const httpServer = require('http-server');
const webpack = require('webpack');
const devUtils = require('./devUtils');
const serverPort = require('./serverPort');

const buildTargetBrowser = devUtils.getBuildTargetBrowser();

const port = serverPort.getSourceMapServerPort();

const isSourcemapEnabled = process.env.GENERATE_SOURCEMAP === 'true';

function createSourcemapBuildPlugin() {
  return new webpack.SourceMapDevToolPlugin({
    append: `\n//# sourceMappingURL=http://127.0.0.1:${port}/[url]?hash=[hash:6]`,
    filename: '[file].map',
    // TODO eval is NOT support in Ext.
    //      sourcemap building is very very very SLOW
    module: true,
    columns: true,
  });
}

function startServer() {
  const servePath = `./build/${devUtils.getOutputFolder()}`;
  // Start stand-alone sourcemap file server: http://127.0.0.1:31317
  const server = httpServer.createServer({
    root: servePath,
  });
  console.log(
    `  sourcemap server starting >>>>>>> http://127.0.0.1:${port}  serve: ${servePath}`,
  );
  server.listen(port, null);
}

module.exports = {
  startServer,
  port,
  isSourcemapEnabled,
  createSourcemapBuildPlugin,
};
