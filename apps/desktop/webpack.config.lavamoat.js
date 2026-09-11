require('../../development/env');

const desktopConfig = require('../../development/webpack/webpack.desktop.config');

module.exports = desktopConfig({ basePath: __dirname });
