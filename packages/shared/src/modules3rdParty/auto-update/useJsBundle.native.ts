import { NativeModules } from 'react-native';

const BundleUpdateModule = NativeModules.BundleUpdateModule as {
  jsBundlePath: () => string;
};
const jsBundlePath = BundleUpdateModule
  ? BundleUpdateModule.jsBundlePath()
  : '';

export const useJsBundle = !!jsBundlePath;
