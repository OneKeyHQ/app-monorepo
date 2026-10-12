const lodash = require('lodash');

const isDev = process.env.NODE_ENV !== 'production';

const chromeConfig = require('./chrome');

module.exports = lodash.merge({}, chromeConfig, {
  content_scripts: chromeConfig.content_scripts.map((contentScript) => ({
    ...contentScript,
    js: isDev
      ? contentScript.js
      : [
          'release-meta.js',
          'content-script-runtime.bundle.js',
          'content-script-vendor.bundle.js',
          'content-script.bundle.js',
        ],
  })),
});
