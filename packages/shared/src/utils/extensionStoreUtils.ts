import { EXTENSION_STORE_URLS } from '../config/extensionConfig';
import platformEnv from '../platformEnv';

export function getOneKeyExtensionStoreUrl() {
  if (platformEnv.isRuntimeEdge) {
    return EXTENSION_STORE_URLS.edge;
  }
  return EXTENSION_STORE_URLS.chrome;
}
