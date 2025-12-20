import { BigNumber } from 'bignumber.js';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

function extractCurrencySymbol(
  priceString: string | undefined,
  {
    useShortUSSymbol,
  }: {
    useShortUSSymbol?: boolean;
  } = {},
): string {
  const cleanString = (priceString || '').replace(/^-/, '');
  const match = cleanString.match(/^[^0-9.-]*/);
  let r = match ? match?.[0] : '';
  r = r || '';
  if (useShortUSSymbol && r === 'US$') {
    return '$';
  }
  return r;
}

function trackPrimeSubscriptionSuccess({
  paywallPackage,
  subscriptionPeriod,
  featureName,
}: {
  paywallPackage: {
    rcBillingProduct: {
      currentPrice: {
        amountMicros: number;
        formattedPrice: string;
      };
    };
  };
  subscriptionPeriod: string;
  featureName?: EPrimeFeatures;
}) {
  // Track successful subscription
  const planType = subscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';

  let amount = 0;
  try {
    const amountMicros =
      paywallPackage.rcBillingProduct.currentPrice?.amountMicros;
    if (amountMicros && typeof amountMicros === 'number') {
      amount = new BigNumber(amountMicros).div(1_000_000).toNumber();
    }
  } catch (error) {
    console.warn('Error converting price amount:', error);
    amount = 0;
  }

  let currency = 'USD';
  try {
    const formattedPrice =
      paywallPackage.rcBillingProduct.currentPrice?.formattedPrice;
    if (formattedPrice) {
      currency =
        extractCurrencySymbol(formattedPrice, {
          useShortUSSymbol: true,
        }) || 'USD';
    }
  } catch (error) {
    console.warn('Error extracting currency:', error);
    currency = 'USD';
  }

  defaultLogger.prime.subscription.primeSubscribeSuccess({
    planType,
    amount,
    currency,
    featureName,
  });
}

const primePaymentUtils = {
  extractCurrencySymbol,
  trackPrimeSubscriptionSuccess,
};

export default primePaymentUtils;
