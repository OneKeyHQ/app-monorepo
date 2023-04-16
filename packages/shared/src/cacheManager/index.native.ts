import { NativeModules } from 'react-native';

async function clearWebViewData() {
  return NativeModules.CacheManager.clearWebViewData()
    .then((res) => res)
    .catch(() => false);
}

export { clearWebViewData };
