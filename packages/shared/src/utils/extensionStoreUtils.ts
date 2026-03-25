import { EXT_RATE_URL } from '../config/appConfig';
import platformEnv from '../platformEnv';

export function getOneKeyExtensionStoreUrl() {
  if (platformEnv.isRuntimeFirefox || platformEnv.isExtFirefox) {
    return EXT_RATE_URL.firefox;
  }
  if (platformEnv.isRuntimeEdge) {
    return EXT_RATE_URL.edge;
  }
  return EXT_RATE_URL.chrome;
}
