import axios from 'axios';
import PurchasesReactNative from 'react-native-purchases';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeWebPurchaseLinkConfig } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IPrimeWebCheckoutOpenOptions,
  IPrimeWebCheckoutPendingSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import {
  resolvePrimeWebPurchaseLinkPackage,
  withPrimeWebPurchaseLinkEmail,
} from './primeWebPurchaseLink';
import { configureRevenueCat } from './revenueCatNativeCompatibility.native';

import type { IPrimeWebCheckoutEntitlement } from './primeWebCheckoutResult';
import type {
  IPrimeWebPurchaseLinkOffering,
  IPrimeWebPurchaseLinkPackage,
} from './primeWebPurchaseLink';
import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

const PRIME_ENTITLEMENT_ID = 'Prime';

// Android only: RevenueCat customer info is project-wide, so the store SDK
// also sees Web Billing entitlements. The SDK key does not depend on the
// checkout's sandbox mode; `isSandbox` is compared on the entitlement.
export async function fetchPrimeWebCheckoutEntitlement({
  onekeyUserId,
}: {
  onekeyUserId: string;
  isSandbox: boolean;
}): Promise<IPrimeWebCheckoutEntitlement | undefined> {
  if (!onekeyUserId) {
    throw new OneKeyLocalError('Prime web checkout: missing OneKey ID');
  }
  // Never log the shared SDK back into a OneKey ID that has logged out.
  const currentUser = await backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (!currentUser.isLoggedIn || currentUser.onekeyUserId !== onekeyUserId) {
    throw new OneKeyLocalError('Prime purchase user changed');
  }
  if (!(await PurchasesReactNative.isConfigured())) {
    const { apiKey } = await getPrimePaymentApiKey({ apiKeyType: 'native' });
    configureRevenueCat({ apiKey });
  }
  if ((await PurchasesReactNative.getAppUserID()) !== onekeyUserId) {
    await PurchasesReactNative.logIn(onekeyUserId);
  }
  // The native SDK caches customer info; a poll must hit RevenueCat.
  await PurchasesReactNative.invalidateCustomerInfoCache();
  const customerInfo = await PurchasesReactNative.getCustomerInfo();
  if ((await PurchasesReactNative.getAppUserID()) !== onekeyUserId) {
    throw new OneKeyLocalError('AppUserId not match');
  }
  const entitlement = customerInfo.entitlements.active[PRIME_ENTITLEMENT_ID];
  if (!entitlement) {
    return undefined;
  }
  return {
    isActive: entitlement.isActive,
    // Native reports e.g. RC_BILLING; match the purchases-js values.
    store: entitlement.store.toLowerCase(),
    latestPurchaseDate: Number.isFinite(entitlement.latestPurchaseDateMillis)
      ? new Date(entitlement.latestPurchaseDateMillis)
      : null,
    isSandbox: entitlement.isSandbox,
    periodType: entitlement.periodType.toLowerCase(),
    productIdentifier: entitlement.productIdentifier,
  };
}

function readRevenueCatRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// Mirrors the read-only wire contract of the locked purchases-js 0.15.1.
// The native host verifies the offering and product itself; bridge fields
// must never choose the package, billing period or price of a hosted link.
export async function resolvePrimeWebCheckoutPackage({
  config,
  onekeyUserId,
  isSandbox,
  currency,
  subscriptionPeriod,
}: {
  config: IPrimeWebPurchaseLinkConfig;
  onekeyUserId: string;
  isSandbox: boolean;
  currency?: string;
  subscriptionPeriod: ISubscriptionPeriod;
}): Promise<IPrimeWebPurchaseLinkPackage> {
  const headers = {
    Authorization: `Bearer ${isSandbox ? REVENUECAT_API_KEY_WEB_SANDBOX : REVENUECAT_API_KEY_WEB}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Platform': 'web',
    'X-Version': '0.15.1',
    'X-Is-Sandbox': String(isSandbox),
  };
  const userPath = encodeURIComponent(onekeyUserId);
  const { data: rawOfferings } = await axios.get<unknown>(
    `https://api.revenuecat.com/v1/subscribers/${userPath}/offerings`,
    { headers, timeout: 10_000 },
  );
  const offerings = readRevenueCatRecord(rawOfferings);
  const offeringId = isSandbox
    ? config.offeringId
    : offerings?.current_offering_id;
  if (
    typeof offeringId !== 'string' ||
    (config.offeringId && offeringId !== config.offeringId) ||
    !Array.isArray(offerings?.offerings)
  ) {
    throw new OneKeyLocalError('Prime web purchase link offering mismatch');
  }
  const offering = offerings.offerings
    .map(readRevenueCatRecord)
    .find((value) => value?.identifier === offeringId);
  if (!Array.isArray(offering?.packages)) {
    throw new OneKeyLocalError('Prime web purchase link: no offering');
  }
  const packages: { identifier: string; productId: string }[] = [];
  for (const value of offering.packages) {
    const pkg = readRevenueCatRecord(value);
    if (
      typeof pkg?.identifier === 'string' &&
      pkg.identifier &&
      typeof pkg.platform_product_identifier === 'string' &&
      pkg.platform_product_identifier
    ) {
      packages.push({
        identifier: pkg.identifier,
        productId: pkg.platform_product_identifier,
      });
    }
  }
  if (!packages.length) {
    throw new OneKeyLocalError('Prime web purchase link: no packages');
  }
  const query = packages.map(
    ({ productId }) => `id=${encodeURIComponent(productId)}`,
  );
  const requestCurrency = isSandbox ? 'USD' : currency;
  if (requestCurrency)
    query.push(`currency=${encodeURIComponent(requestCurrency)}`);
  const { data: rawProducts } = await axios.get<unknown>(
    `https://api.revenuecat.com/rcbilling/v1/subscribers/${userPath}/products?${query.join('&')}`,
    { headers, timeout: 10_000 },
  );
  const productDetails = readRevenueCatRecord(rawProducts)?.product_details;
  if (!Array.isArray(productDetails)) {
    throw new OneKeyLocalError('Invalid Prime web product response');
  }
  const products = new Map<string, Record<string, unknown>>();
  for (const value of productDetails) {
    const product = readRevenueCatRecord(value);
    if (typeof product?.identifier === 'string')
      products.set(product.identifier, product);
  }
  const availablePackages: IPrimeWebPurchaseLinkOffering['availablePackages'] =
    [];
  packages.forEach((pkg) => {
    const product = products.get(pkg.productId);
    if (product?.product_type !== 'subscription') return;
    const options = readRevenueCatRecord(product.purchase_options);
    const optionId = product.default_purchase_option_id;
    const option =
      typeof optionId === 'string'
        ? readRevenueCatRecord(options?.[optionId])
        : undefined;
    const base = readRevenueCatRecord(option?.base);
    const price = readRevenueCatRecord(base?.price);
    if (
      typeof base?.period_duration !== 'string' ||
      typeof price?.amount_micros !== 'number' ||
      !Number.isFinite(price.amount_micros) ||
      price.amount_micros < 0 ||
      typeof price.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(price.currency)
    )
      return;
    availablePackages.push({
      identifier: pkg.identifier,
      rcBillingProduct: {
        normalPeriodDuration: base.period_duration,
        currentPrice: {
          amountMicros: price.amount_micros,
          currency: price.currency,
        },
      },
    });
  });
  return resolvePrimeWebPurchaseLinkPackage({
    config,
    subscriptionPeriod,
    targetOffering: { identifier: offeringId, availablePackages },
  });
}

// Opens the hosted checkout in the system browser; its return page brings the
// app back through the onekey-wallet:// deep link.
export async function openPrimeWebCheckoutPage(
  session: IPrimeWebCheckoutPendingSession,
  { email }: IPrimeWebCheckoutOpenOptions = {},
): Promise<'opened' | 'navigatedAway'> {
  openUrlUtils.openUrlExternal(
    withPrimeWebPurchaseLinkEmail(session.checkoutUrl, email),
    {
      useSystemBrowser: true,
    },
  );
  return 'opened';
}

// Only extension pages need to tell the initiating surface apart.
export async function isPrimeWebCheckoutInitiatorSurface(
  _session: IPrimeWebCheckoutPendingSession,
): Promise<boolean> {
  return true;
}
