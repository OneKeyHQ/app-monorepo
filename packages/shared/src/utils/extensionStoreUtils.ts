import { EXTENSION_STORE_URLS } from '../config/extensionConfig';
import platformEnv from '../platformEnv';

export function getOneKeyExtensionStoreUrl() {
  if (platformEnv.isRuntimeFirefox || platformEnv.isExtFirefox) {
    return EXTENSION_STORE_URLS.firefox;
  }
  if (platformEnv.isRuntimeEdge) {
    return EXTENSION_STORE_URLS.edge;
  }
  return EXTENSION_STORE_URLS.chrome;
}
