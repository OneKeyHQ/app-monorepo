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

export const hasJsBundle = () => {
  return !!getJsBundlePath();
};

export const hasJsBundleAsync = async () => {
  return Promise.resolve(hasJsBundle());
};
