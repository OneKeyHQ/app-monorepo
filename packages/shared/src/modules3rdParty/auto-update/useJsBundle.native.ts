import { ReactNativeBundleUpdate } from '@onekeyfe/react-native-bundle-update';

// getWebEmbedPath() is synchronous and returns e.g. ".../1.0.0-5/web-embed".
// polyfillsPlatform.js splits on "/main.jsbundle.hbc" to derive the assets
// directory, so we must return a path ending with that filename.
const webEmbedPath: string = ReactNativeBundleUpdate.getWebEmbedPath() || '';
const jsBundlePath: string = webEmbedPath
  ? webEmbedPath.replace(/\/web-embed$/, '/main.jsbundle.hbc')
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

// eslint-disable-next-line react-hooks/rules-of-hooks
// oxlint-disable-next-line eslint-plugin-react-hooks/rules-of-hooks
export const useJsBundleAsync = async () => {
  return Promise.resolve(useJsBundle());
};
