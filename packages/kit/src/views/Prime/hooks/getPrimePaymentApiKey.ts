import {
  REVENUECAT_API_KEY_APPLE,
  REVENUECAT_API_KEY_GOOGLE,
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export type IGetPrimePaymentApiKey = {
  apiKey: string;
  isSandboxKey: boolean;
};
export async function getPrimePaymentApiKey({
  apiKeyType,
}: {
  apiKeyType: 'native' | 'web';
}): Promise<IGetPrimePaymentApiKey> {
  if (apiKeyType === 'web') {
    const devSettings =
      await backgroundApiProxy.serviceDevSetting.getDevSetting();
    let isSandboxKey = false;
    let apiKey = REVENUECAT_API_KEY_WEB;
    if (devSettings?.settings?.usePrimeSandboxPayment) {
      isSandboxKey = true;
      apiKey = REVENUECAT_API_KEY_WEB_SANDBOX;
    }

    if (!apiKey) {
      throw new OneKeyLocalError('No REVENUECAT api key found');
    }

    return { apiKey, isSandboxKey };
  }

  let apiKey = '';
  if (platformEnv.isNativeIOS) {
    apiKey = REVENUECAT_API_KEY_APPLE || '';
  }
  if (platformEnv.isNativeAndroid) {
    apiKey = REVENUECAT_API_KEY_GOOGLE || '';
  }
  if (!apiKey) {
    throw new OneKeyLocalError('No REVENUECAT api key found');
  }

  return { apiKey, isSandboxKey: false };
}
