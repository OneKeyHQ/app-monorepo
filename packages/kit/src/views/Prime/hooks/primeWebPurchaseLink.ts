import {
  PRIME_WEB_PURCHASE_LINK_PRODUCTION,
  PRIME_WEB_PURCHASE_LINK_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import type { IPrimeWebPurchaseLinkConfig } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPrimeWebCheckoutPlatform } from '@onekeyhq/shared/types/prime/primeTypes';

import primePaymentUtils from './primePaymentUtils';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

export type IPrimeWebPurchaseLinkOffering = {
  identifier: string;
  availablePackages: {
    identifier: string;
    rcBillingProduct: {
      normalPeriodDuration: string | null;
      currentPrice?: {
        amountMicros?: number;
        currency?: string;
      } | null;
    };
  }[];
};

export type IPrimeWebPurchaseLinkPackage = {
  packageId: string;
  offeringId: string;
  // The package's billing period, which must be the plan the user picked.
  subscriptionPeriod: ISubscriptionPeriod;
  amount: number;
  currency: string;
};

export function getPrimeWebPurchaseLinkConfig({
  isSandbox,
}: {
  isSandbox: boolean;
}): IPrimeWebPurchaseLinkConfig {
  return isSandbox
    ? PRIME_WEB_PURCHASE_LINK_SANDBOX
    : PRIME_WEB_PURCHASE_LINK_PRODUCTION;
}

// A Purchase Link belongs to one offering, so the package shown in the app
// must come from that offering or the hosted page would charge another price.
export function resolvePrimeWebPurchaseLinkPackage({
  config,
  targetOffering,
  subscriptionPeriod,
}: {
  config: IPrimeWebPurchaseLinkConfig;
  targetOffering: IPrimeWebPurchaseLinkOffering | null | undefined;
  subscriptionPeriod: ISubscriptionPeriod;
}): IPrimeWebPurchaseLinkPackage {
  if (!targetOffering) {
    throw new OneKeyLocalError('Prime web purchase link: no offering');
  }
  if (config.offeringId && targetOffering.identifier !== config.offeringId) {
    throw new OneKeyLocalError(
      `Prime web purchase link offering mismatch: ${targetOffering.identifier}`,
    );
  }
  const paywallPackage = targetOffering.availablePackages.find(
    (p) => p.rcBillingProduct.normalPeriodDuration === subscriptionPeriod,
  );
  if (!paywallPackage) {
    throw new OneKeyLocalError(
      `Prime web purchase link: no package for ${subscriptionPeriod}`,
    );
  }
  const { amount, currency } =
    primePaymentUtils.extractWebPaywallPrice(paywallPackage);
  return {
    packageId: paywallPackage.identifier,
    offeringId: targetOffering.identifier,
    subscriptionPeriod,
    amount,
    currency: currency || 'USD',
  };
}

// Validates a package resolved elsewhere (the Android web-embed checkout)
// before it goes into a Purchase Link. The hosted page itself shows the
// price RevenueCat holds for the package; this keeps the package on the
// configured offering and on the plan the user picked.
export function parsePrimeWebPurchaseLinkPackage({
  config,
  subscriptionPeriod: expectedSubscriptionPeriod,
  value,
}: {
  config: IPrimeWebPurchaseLinkConfig;
  subscriptionPeriod: ISubscriptionPeriod;
  value: unknown;
}): IPrimeWebPurchaseLinkPackage | undefined {
  const { packageId, offeringId, subscriptionPeriod, amount, currency } =
    (value ?? {}) as Record<string, unknown>;
  if (
    typeof packageId !== 'string' ||
    !packageId ||
    typeof offeringId !== 'string' ||
    !offeringId ||
    subscriptionPeriod !== expectedSubscriptionPeriod ||
    typeof currency !== 'string' ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    (config.offeringId && offeringId !== config.offeringId)
  ) {
    return undefined;
  }
  return {
    packageId,
    offeringId,
    subscriptionPeriod: expectedSubscriptionPeriod,
    amount,
    currency,
  };
}

// The email never goes into the stored link; see
// withPrimeWebPurchaseLinkEmail.
export function buildPrimeWebPurchaseLinkUrl({
  config,
  onekeyUserId,
  packageId,
  currency,
  platform,
  featureName,
}: {
  config: IPrimeWebPurchaseLinkConfig;
  onekeyUserId: string;
  packageId: string;
  // Omit in sandbox: the sandbox offering is only priced in USD.
  currency?: string;
  platform: IPrimeWebCheckoutPlatform;
  featureName?: string;
}): string {
  if (!onekeyUserId) {
    throw new OneKeyLocalError('Prime web purchase link: missing OneKey ID');
  }
  const baseUrl = config.baseUrl.endsWith('/')
    ? config.baseUrl
    : `${config.baseUrl}/`;
  const query: [string, string][] = [['package_id', packageId]];
  if (currency) {
    query.push(['currency', currency]);
  }
  // Return to OneKey right after payment; success is confirmed by polling.
  query.push(['skip_purchase_success', 'true']);
  query.push(['utm_source', `onekey_${platform}`]);
  if (featureName) {
    query.push(['utm_campaign', featureName]);
  }
  // Built by hand so it behaves the same in runtimes without a full URL API.
  const queryString = query
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
  return `${baseUrl}${encodeURIComponent(onekeyUserId)}?${queryString}`;
}

// The email only prefills the hosted form, so it is added when the link is
// opened and never persisted with the pending checkout.
export function withPrimeWebPurchaseLinkEmail(
  checkoutUrl: string,
  email: string | undefined,
): string {
  if (!email) {
    return checkoutUrl;
  }
  const separator = checkoutUrl.includes('?') ? '&' : '?';
  return `${checkoutUrl}${separator}email=${encodeURIComponent(email)}`;
}

// Both production and sandbox links are served from this origin.
export function isPrimeWebPurchaseLinkPageUrl(url: string | undefined) {
  if (!url) {
    return false;
  }
  try {
    return (
      new URL(url).origin ===
      new URL(PRIME_WEB_PURCHASE_LINK_PRODUCTION.baseUrl).origin
    );
  } catch {
    return false;
  }
}
