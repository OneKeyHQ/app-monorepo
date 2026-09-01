import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';

const jsBundlePath: string = ReactNativeBundleUpdate.getJsBundlePath() || '';

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
  return Promise.resolve(!!getJsBundlePath());
};
