const path = require('node:path');

function toPosixRelative(rootDir, targetPath) {
  return path.relative(rootDir, targetPath).split(path.sep).join('/');
}

module.exports = function sentryRelativeSourcePath(_api, { rootDir }) {
  return {
    name: 'onekey-sentry-relative-source-path',
    pre(file) {
      const parserOpts = file.opts.parserOpts;
      if (!parserOpts) {
        return;
      }
      const sourceFileName = parserOpts.sourceFileName;
      if (
        typeof sourceFileName === 'string' &&
        path.isAbsolute(sourceFileName)
      ) {
        parserOpts.sourceFileName = toPosixRelative(rootDir, sourceFileName);
      } else if (
        !sourceFileName &&
        typeof file.opts.filename === 'string' &&
        path.isAbsolute(file.opts.filename)
      ) {
        parserOpts.sourceFileName = toPosixRelative(
          rootDir,
          file.opts.filename,
        );
      }
    },
  };
};
