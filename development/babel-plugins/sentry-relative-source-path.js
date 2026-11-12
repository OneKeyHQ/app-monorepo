const path = require('node:path');

module.exports = function sentryRelativeSourcePath(_api, { rootDir }) {
  return {
    name: 'onekey-sentry-relative-source-path',
    pre(file) {
      const sourceFileName = file.opts.parserOpts?.sourceFileName;
      if (typeof sourceFileName === 'string') {
        file.opts.parserOpts.sourceFileName = path
          .relative(rootDir, sourceFileName)
          .split(path.sep)
          .join('/');
      }
    },
  };
};
