import { NativeModules } from 'react-native';

const BundleUpdateModule = NativeModules.BundleUpdateModule as {
  jsBundlePath: () => string;
};
const jsBundlePath =
  BundleUpdateModule && BundleUpdateModule.jsBundlePath
    ? BundleUpdateModule.jsBundlePath()
    : '';

export const getJsBundlePath = () => {
  return jsBundlePath;
};

export const getJsBundlePathAsync = async () => {
  return Promise.resolve(jsBundlePath);
};

export const useJsBundle = () => {
  return !!getJsBundlePath();
};

export const useJsBundleAsync = async () => {
  return Promise.resolve(useJsBundle());
};
