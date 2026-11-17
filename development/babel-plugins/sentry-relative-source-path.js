const path = require('node:path');

module.exports = function sentryRelativeSourcePath(_api, { rootDir }) {
  return {
    name: 'onekey-sentry-relative-source-path',
    pre(file) {
      const sourceFileName = file.opts.parserOpts?.sourceFileName;
      if (typeof sourceFileName !== 'string') return;
      const paths = /^[A-Za-z]:[\\/]/.test(rootDir) ? path.win32 : path;
      const relative = paths.isAbsolute(sourceFileName)
        ? paths.relative(rootDir, sourceFileName)
        : sourceFileName;
      const normalized = relative.replace(/\\/g, '/');
      if (
        paths.isAbsolute(relative) ||
        normalized === '..' ||
        normalized.startsWith('../') ||
        normalized.split('/').includes('node_modules')
      )
        return;
      file.opts.parserOpts.sourceFileName = normalized;
    },
  };
};
