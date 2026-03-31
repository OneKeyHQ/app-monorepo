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
        currency: string;
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

  const currency =
    paywallPackage.rcBillingProduct.currentPrice?.currency || 'USD';

  defaultLogger.prime.subscription.primeSubscribeSuccess({
    planType,
    amount,
    currency,
    featureName,
  });
}

function formatPriceString(
  amount: BigNumber | number,
  currencyCode: string,
): string {
  const bn = amount instanceof BigNumber ? amount : new BigNumber(amount);
  const decimals = bn.isInteger() ? 0 : 2;
  const formatted = bn.toFormat(decimals);
  return `${formatted} ${currencyCode}`;
}

const primePaymentUtils = {
  extractCurrencySymbol,
  trackPrimeSubscriptionSuccess,
  formatPriceString,
};

export default primePaymentUtils;
