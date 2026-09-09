require('../../development/env');

const createExtensionConfig = require('../../development/webpack/webpack.ext.config');

module.exports = createExtensionConfig({ basePath: __dirname });
