require('../../development/env');

const webConfig = require('../../development/webpack/webpack.web-embed.config');

console.log(
  'process.env.REVENUECAT_API_KEY_WEB_SANDBOX',
  process.env.REVENUECAT_API_KEY_WEB_SANDBOX,
);

module.exports = webConfig({ basePath: __dirname });
