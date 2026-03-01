import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';

const jsBundlePath: string = ReactNativeBundleUpdate.getWebEmbedPath() || '';

export const getJsBundlePath = () => {
  return jsBundlePath;
};

export const getJsBundlePathAsync = async () => {
  return Promise.resolve(jsBundlePath);
};

export const useJsBundle = () => {
  return !!getJsBundlePath();
};

// oxlint-disable-next-line eslint-plugin-react-hooks/rules-of-hooks
export const useJsBundleAsync = async () => {
  return Promise.resolve(useJsBundle());
};
