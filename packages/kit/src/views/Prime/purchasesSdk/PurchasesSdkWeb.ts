import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PurchasesSdkWebBase } from './PurchasesSdkWebBase';

export default class PurchasesSdkWeb extends PurchasesSdkWebBase {
  async getApiKey(): Promise<string> {
    const devSettings =
      await backgroundApiProxy.serviceDevSetting.getDevSetting();
    let apiKey = process.env.REVENUECAT_API_KEY_WEB;
    if (devSettings?.settings?.usePrimeSandboxPayment) {
      apiKey = process.env.REVENUECAT_API_KEY_WEB_SANDBOX;
    }
    if (!apiKey) {
      throw new Error('No REVENUECAT api key found');
    }
    return apiKey;
  }
}
