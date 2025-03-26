import { LogLevel, Purchases } from '@revenuecat/purchases-js';

import {
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

if (process.env.NODE_ENV !== 'production') {
  Purchases.setLogLevel(LogLevel.Verbose);
}

export async function getPrimePaymentWebApiKey() {
  const devSettings =
    await backgroundApiProxy.serviceDevSetting.getDevSetting();
  let apiKey = REVENUECAT_API_KEY_WEB;
  if (devSettings?.settings?.usePrimeSandboxPayment) {
    apiKey = REVENUECAT_API_KEY_WEB_SANDBOX;
  }

  return apiKey;
}
