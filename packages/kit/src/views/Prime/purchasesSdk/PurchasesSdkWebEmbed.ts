import { PurchasesSdkWebBase } from './PurchasesSdkWebBase';

export default class PurchasesSdkWeb extends PurchasesSdkWebBase {
  async getApiKey(): Promise<string> {
    const settings = globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS;
    return settings?.revenuecatApiKey || '';
  }
}
