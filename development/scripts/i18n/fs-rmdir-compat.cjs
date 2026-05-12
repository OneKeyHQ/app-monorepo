/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

function shouldUseRm(options) {
  return Boolean(
    options &&
    typeof options === 'object' &&
    options.recursive === true &&
    typeof fs.rmSync === 'function',
  );
}

const originalRmdirSync = fs.rmdirSync.bind(fs);
fs.rmdirSync = function patchedRmdirSync(targetPath, options) {
  if (shouldUseRm(options)) {
    return fs.rmSync(targetPath, options);
  }

  return originalRmdirSync(targetPath, options);
};

const originalRmdir = fs.rmdir.bind(fs);
fs.rmdir = function patchedRmdir(targetPath, options, callback) {
  let normalizedOptions = options;
  let normalizedCallback = callback;

  if (typeof normalizedOptions === 'function') {
    normalizedCallback = normalizedOptions;
    normalizedOptions = undefined;
  }

  if (shouldUseRm(normalizedOptions) && typeof fs.rm === 'function') {
    return fs.rm(targetPath, normalizedOptions, normalizedCallback);
  }

  if (typeof normalizedCallback === 'function') {
    return originalRmdir(targetPath, normalizedOptions, normalizedCallback);
  }

  return originalRmdir(targetPath, normalizedOptions);
};

if (
  typeof fsPromises.rmdir === 'function' &&
  typeof fsPromises.rm === 'function'
) {
  const originalPromisesRmdir = fsPromises.rmdir.bind(fsPromises);
  fsPromises.rmdir = function patchedPromisesRmdir(targetPath, options) {
    if (shouldUseRm(options)) {
      return fsPromises.rm(targetPath, options);
    }

    return originalPromisesRmdir(targetPath, options);
  };
}
