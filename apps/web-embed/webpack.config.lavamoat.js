require('../../development/env');

const createConfig = require('../../development/webpack/webpack.web-embed.config');

module.exports = createConfig({ basePath: __dirname });
