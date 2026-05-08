import { BigNumber } from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import type {
  IPackageFreeTrial,
  ISubscriptionPeriod,
} from './usePrimePaymentTypes';
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
  amount,
  currency,
  subscriptionPeriod,
  featureName,
}: {
  amount: number;
  currency?: string;
  subscriptionPeriod: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
}) {
  const planType = subscriptionPeriod === 'P1Y' ? 'yearly' : 'monthly';
  defaultLogger.prime.subscription.primeSubscribeSuccess({
    planType,
    amount,
    currency: currency || 'USD',
    featureName,
  });
}

// RevenueCat React Native SDK returns prices in micros on Android, in major
// units on iOS — normalize to major units here.
function normalizeNativePrice(rawPrice: number): number {
  if (!platformEnv.isNativeAndroid) return rawPrice;
  return new BigNumber(rawPrice || 0).div(1_000_000).toNumber();
}

function extractWebPaywallPrice(paywallPackage: {
  rcBillingProduct: {
    currentPrice?: {
      amountMicros?: number;
      currency?: string;
    } | null;
  };
}): { amount: number; currency: string | undefined } {
  const { currentPrice } = paywallPackage.rcBillingProduct;
  const amountMicros = currentPrice?.amountMicros;
  const amount =
    typeof amountMicros === 'number'
      ? new BigNumber(amountMicros).div(1_000_000).toNumber()
      : 0;
  return { amount, currency: currentPrice?.currency };
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
  normalizeNativePrice,
  extractWebPaywallPrice,
  formatPriceString,
  normalizeFreeTrialPeriodUnit,
  extractWebFreeTrial,
  extractNativeFreeTrial,
  fetchWebTargetOffering,
};

export default primePaymentUtils;
