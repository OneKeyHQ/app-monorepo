import { REVENUECAT_API_KEY_WEB_SANDBOX } from '@onekeyhq/shared/src/consts/primeConsts';

import { PurchasesSdkWebBase } from './PurchasesSdkWebBase';

export default class PurchasesSdkWeb extends PurchasesSdkWebBase {
  async getApiKey(): Promise<string> {
    const settings = globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS;
    if (process.env.NODE_ENV !== 'production') {
      if (!settings?.revenuecatApiKey) {
        return REVENUECAT_API_KEY_WEB_SANDBOX || '';
      }
    }
    return settings?.revenuecatApiKey || '';
  }
}
