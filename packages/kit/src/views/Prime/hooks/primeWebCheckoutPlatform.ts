import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import type { IPrimeWebPurchaseLinkConfig } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IPrimeWebCheckoutExtensionContext,
  IPrimeWebCheckoutPendingSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { loadPurchasesSdkWeb } from '../purchasesSdk/purchasesSdkWebLoader';

import primePaymentUtils from './primePaymentUtils';
import { resolvePrimeWebPurchaseLinkPackage } from './primeWebPurchaseLink';

import type { IPrimeWebCheckoutEntitlement } from './primeWebCheckoutResult';
import type { IPrimeWebPurchaseLinkPackage } from './primeWebPurchaseLink';
import type { ISubscriptionPeriod } from './usePrimePaymentTypes';

const PRIME_ENTITLEMENT_ID = 'Prime';

async function configurePurchasesSdk({
  onekeyUserId,
  isSandbox,
}: {
  onekeyUserId: string;
  isSandbox: boolean;
}) {
  const { Purchases } = await loadPurchasesSdkWeb();
  // Uses the API key of the checkout's sandbox mode rather than the current
  // dev setting, so a mode switch cannot attribute the purchase elsewhere.
  Purchases.configure(
    isSandbox ? REVENUECAT_API_KEY_WEB_SANDBOX : REVENUECAT_API_KEY_WEB,
    onekeyUserId,
  );
  return Purchases.getSharedInstance();
}

export async function fetchPrimeWebCheckoutEntitlement({
  onekeyUserId,
  isSandbox,
}: {
  onekeyUserId: string;
  isSandbox: boolean;
}): Promise<IPrimeWebCheckoutEntitlement | undefined> {
  if (!onekeyUserId) {
    throw new OneKeyLocalError('Prime web checkout: missing OneKey ID');
  }
  const purchases = await configurePurchasesSdk({ onekeyUserId, isSandbox });
  // purchases-js does not cache customer info, so every poll is fresh.
  const customerInfo = await purchases.getCustomerInfo();
  if (purchases.getAppUserId() !== onekeyUserId) {
    throw new OneKeyLocalError('AppUserId not match');
  }
  return customerInfo.entitlements.active[PRIME_ENTITLEMENT_ID];
}

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
  const purchases = await configurePurchasesSdk({ onekeyUserId, isSandbox });
  const { targetOffering } = await primePaymentUtils.fetchWebTargetOffering({
    purchases,
    isSandboxKey: isSandbox,
    currency,
  });
  return resolvePrimeWebPurchaseLinkPackage({
    config,
    targetOffering,
    subscriptionPeriod,
  });
}

async function getExtensionCheckoutInitiator(): Promise<IPrimeWebCheckoutExtensionContext> {
  if (platformEnv.isExtensionUiSidePanel) {
    return { initiatorKind: 'sidePanel' };
  }
  const currentTab = await new Promise<chrome.tabs.Tab | undefined>(
    (resolve) => {
      chrome.tabs.getCurrent((tab) => {
        void chrome.runtime.lastError;
        resolve(tab);
      });
    },
  );
  return { initiatorKind: 'tab', initiatorTabId: currentTab?.id };
}

async function openExtensionCheckoutTab(
  session: IPrimeWebCheckoutPendingSession,
) {
  const initiator =
    session.extension ?? (await getExtensionCheckoutInitiator());
  // Reuses the checkout tab when it still exists.
  const checkoutTab = await extUtils.openUrlInTab(session.checkoutUrl, {
    tabId: session.extension?.checkoutTabId,
  });
  if (checkoutTab?.id === undefined) {
    throw new OneKeyLocalError('Failed to open the checkout tab');
  }
  await backgroundApiProxy.simpleDb.prime.updateWebCheckoutPendingSessionExtensionContext(
    {
      onekeyUserId: session.onekeyUserId,
      checkoutId: session.checkoutId,
      extension: { ...initiator, checkoutTabId: checkoutTab.id },
    },
  );
}

// Opens (or reopens) the hosted checkout page. 'navigatedAway' means this
// page is unloading; the return page resumes the checkout.
export async function openPrimeWebCheckoutPage(
  session: IPrimeWebCheckoutPendingSession,
): Promise<'opened' | 'navigatedAway'> {
  if (platformEnv.isExtension) {
    await openExtensionCheckoutTab(session);
    return 'opened';
  }
  if (platformEnv.isDesktop) {
    // window.open is handed to the system browser by the desktop shell.
    openUrlUtils.openUrlExternal(session.checkoutUrl, {
      useSystemBrowser: true,
    });
    return 'opened';
  }
  if (platformEnv.isWeb && !platformEnv.isWebEmbed) {
    // Same-tab navigation is never blocked as a popup, even without a user
    // gesture (e.g. after an automatic fallback).
    globalThis.location.assign(session.checkoutUrl);
    return 'navigatedAway';
  }
  throw new OneKeyLocalError(
    'Hosted card checkout is not available on this platform',
  );
}
