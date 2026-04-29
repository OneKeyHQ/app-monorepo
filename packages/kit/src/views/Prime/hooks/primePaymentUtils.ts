import { BigNumber } from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import type { IPackageFreeTrial } from './usePrimePaymentTypes';
import type { Offerings, Purchases } from '@revenuecat/purchases-js';

const SANDBOX_OFFERING_ID = 'Sandbox_testing';

const FREE_TRIAL_PERIOD_UNITS: ReadonlySet<IPackageFreeTrial['periodUnit']> =
  new Set(['day', 'week', 'month', 'year']);

function normalizeFreeTrialPeriodUnit(
  unit: string | undefined,
): IPackageFreeTrial['periodUnit'] | undefined {
  const lower = (unit || '').toLowerCase();
  return FREE_TRIAL_PERIOD_UNITS.has(lower as IPackageFreeTrial['periodUnit'])
    ? (lower as IPackageFreeTrial['periodUnit'])
    : undefined;
}

type IWebTrialPhase =
  | {
      price: { amountMicros: number } | null;
      period: { number: number; unit: IPackageFreeTrial['periodUnit'] } | null;
      periodDuration: string | null;
    }
  | null
  | undefined;

function extractWebFreeTrial(
  trial: IWebTrialPhase,
): IPackageFreeTrial | undefined {
  if (
    !trial ||
    trial.price !== null ||
    !trial.period ||
    !trial.periodDuration
  ) {
    return undefined;
  }
  return {
    periodIso: trial.periodDuration,
    periodNumber: trial.period.number,
    periodUnit: trial.period.unit,
  };
}

type INativeProductForTrial = {
  introPrice:
    | {
        price: number;
        period: string;
        periodUnit: string;
        periodNumberOfUnits: number;
      }
    | null
    | undefined;
  defaultOption?: {
    freePhase: {
      price: { amountMicros: number };
      billingPeriod: { unit: string; value: number; iso8601: string };
    } | null;
  } | null;
};

function extractNativeFreeTrial(
  product: INativeProductForTrial,
): IPackageFreeTrial | undefined {
  const introPrice = product.introPrice;
  if (
    introPrice &&
    introPrice.price === 0 &&
    introPrice.periodNumberOfUnits > 0
  ) {
    const periodUnit = normalizeFreeTrialPeriodUnit(introPrice.periodUnit);
    if (periodUnit) {
      return {
        periodIso: introPrice.period,
        periodNumber: introPrice.periodNumberOfUnits,
        periodUnit,
      };
    }
  }
  // Google Play offers don't always bridge to introPrice — read freePhase directly.
  if (platformEnv.isNativeAndroid) {
    const freePhase = product.defaultOption?.freePhase;
    if (
      freePhase &&
      freePhase.price.amountMicros === 0 &&
      freePhase.billingPeriod.value > 0
    ) {
      const periodUnit = normalizeFreeTrialPeriodUnit(
        freePhase.billingPeriod.unit,
      );
      if (periodUnit) {
        return {
          periodIso: freePhase.billingPeriod.iso8601,
          periodNumber: freePhase.billingPeriod.value,
          periodUnit,
        };
      }
    }
  }
  return undefined;
}

async function fetchWebTargetOffering({
  purchases,
  isSandboxKey,
  currency,
}: {
  purchases: Purchases;
  isSandboxKey: boolean;
  currency?: string;
}): Promise<{
  offerings: Offerings;
  targetOffering: Offerings['current'];
  getOfferingsParams: { currency: string } | undefined;
}> {
  let getOfferingsParams: { currency: string } | undefined;
  if (isSandboxKey) {
    getOfferingsParams = { currency: 'USD' };
  } else if (currency) {
    getOfferingsParams = { currency };
  }
  const offerings = await purchases.getOfferings(getOfferingsParams);
  const targetOffering = isSandboxKey
    ? offerings.all[SANDBOX_OFFERING_ID]
    : offerings.current;
  if (isSandboxKey && !targetOffering) {
    throw new OneKeyLocalError(
      `Sandbox offering not found: ${SANDBOX_OFFERING_ID}`,
    );
  }
  return { offerings, targetOffering, getOfferingsParams };
}

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
  normalizeFreeTrialPeriodUnit,
  extractWebFreeTrial,
  extractNativeFreeTrial,
  fetchWebTargetOffering,
};

export default primePaymentUtils;
