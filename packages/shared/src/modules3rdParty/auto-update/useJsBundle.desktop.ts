/* eslint-disable no-restricted-syntax */
export const getJsBundlePath = () => {
  throw new Error('getJsBundlePath is not supported on desktop');
};

export const getJsBundlePathAsync = async () => {
  return globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath();
};

export const useJsBundle = () => {
  throw new Error('useJsBundle is not supported on desktop');
};

export const useJsBundleAsync = async () => {
  const bundlePath =
    await globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath();
  return !!bundlePath;
};
