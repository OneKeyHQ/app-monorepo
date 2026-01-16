/* eslint-disable no-restricted-syntax */
export const getJsBundlePath = () => {
  throw new Error('getJsBundlePath is not supported on desktop');
};

export const getJsBundlePathAsync = async () => {
  return globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath();
};

export const hasJsBundle = () => {
  throw new Error('hasJsBundle is not supported on desktop');
};

export const hasJsBundleAsync = async () => {
  const bundlePath =
    await globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath();
  return !!bundlePath;
};
