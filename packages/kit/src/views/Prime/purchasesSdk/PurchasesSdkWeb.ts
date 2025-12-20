import {
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PurchasesSdkWebBase } from './PurchasesSdkWebBase';

export default class PurchasesSdkWeb extends PurchasesSdkWebBase {
  async getApiKey(): Promise<string> {
    const devSettings =
      await backgroundApiProxy.serviceDevSetting.getDevSetting();
    let apiKey = REVENUECAT_API_KEY_WEB;
    if (devSettings?.settings?.usePrimeSandboxPayment) {
      apiKey = REVENUECAT_API_KEY_WEB_SANDBOX;
    }
    if (!apiKey) {
      throw new OneKeyLocalError('No REVENUECAT api key found');
    }
    return apiKey;
  }
}
