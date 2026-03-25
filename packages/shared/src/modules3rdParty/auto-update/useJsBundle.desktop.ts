/* eslint-disable no-restricted-syntax */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const getJsBundlePath = () => {
  throw new OneKeyLocalError('getJsBundlePath is not supported on desktop');
};

export const getJsBundlePathAsync = async () => {
  return globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath();
};

export const useJsBundle = () => {
  throw new OneKeyLocalError('useJsBundle is not supported on desktop');
};

export const useJsBundleAsync = async () => {
  const bundlePath =
    await globalThis.desktopApiProxy.bundleUpdate.getJsBundlePath();
  return !!bundlePath;
};
