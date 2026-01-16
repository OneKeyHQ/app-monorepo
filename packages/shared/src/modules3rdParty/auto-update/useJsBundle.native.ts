import { NativeModules } from 'react-native';

const BundleUpdateModule = NativeModules.BundleUpdateModule;

const jsBundlePath: string =
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
