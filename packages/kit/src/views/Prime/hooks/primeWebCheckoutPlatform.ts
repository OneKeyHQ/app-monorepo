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
  IPrimeWebCheckoutOpenOptions,
  IPrimeWebCheckoutPendingSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { loadPurchasesSdkWeb } from '../purchasesSdk/purchasesSdkWebLoader';

import primePaymentUtils from './primePaymentUtils';
import {
  isPrimeWebPurchaseLinkPageUrl,
  resolvePrimeWebPurchaseLinkPackage,
  withPrimeWebPurchaseLinkEmail,
} from './primeWebPurchaseLink';

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

function getCurrentExtensionTab() {
  return new Promise<chrome.tabs.Tab | undefined>((resolve) => {
    chrome.tabs.getCurrent((tab) => {
      void chrome.runtime.lastError;
      resolve(tab);
    });
  });
}

function getCurrentExtensionWindowId() {
  return new Promise<number | undefined>((resolve) => {
    chrome.windows.getCurrent((win) => {
      void chrome.runtime.lastError;
      resolve(win?.id);
    });
  });
}

// The stored tab / window ids, or undefined when they come from another
// browser session (ids are only unique within one session) or none exists.
export async function getUsablePrimeWebCheckoutExtensionContext(
  session: IPrimeWebCheckoutPendingSession,
): Promise<IPrimeWebCheckoutExtensionContext | undefined> {
  const browserSessionId = await extUtils.getBrowserSessionId();
  return browserSessionId &&
    session.extension?.browserSessionId === browserSessionId
    ? session.extension
    : undefined;
}

// Whether this extension page is the one that opened the checkout.
export async function isPrimeWebCheckoutInitiatorSurface(
  session: IPrimeWebCheckoutPendingSession,
): Promise<boolean> {
  if (!platformEnv.isExtension) {
    return true;
  }
  const extension = await getUsablePrimeWebCheckoutExtensionContext(session);
  if (!extension) {
    return false;
  }
  if (platformEnv.isExtensionUiSidePanel) {
    return (
      extension.initiatorKind === 'sidePanel' &&
      extension.initiatorWindowId !== undefined &&
      extension.initiatorWindowId === (await getCurrentExtensionWindowId())
    );
  }
  return (
    extension.initiatorKind === 'tab' &&
    extension.initiatorTabId !== undefined &&
    extension.initiatorTabId === (await getCurrentExtensionTab())?.id
  );
}

async function getExtensionCheckoutInitiator(): Promise<IPrimeWebCheckoutExtensionContext> {
  if (platformEnv.isExtensionUiSidePanel) {
    return {
      initiatorKind: 'sidePanel',
      initiatorWindowId: await getCurrentExtensionWindowId(),
    };
  }
  return {
    initiatorKind: 'tab',
    initiatorTabId: (await getCurrentExtensionTab())?.id,
  };
}

function getExtensionTab(tabId: number) {
  return new Promise<chrome.tabs.Tab | undefined>((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      void chrome.runtime.lastError;
      resolve(tab);
    });
  });
}

function isMatchingCheckoutPageUrl(
  url: string | undefined,
  checkoutUrl: string,
) {
  if (!url || !isPrimeWebPurchaseLinkPageUrl(url)) {
    return false;
  }
  try {
    const current = new URL(url);
    const expected = new URL(checkoutUrl);
    // Preserve the link, OneKey ID and payment parameters, including duplicate
    // query values. Email prefill and attribution do not identify the payment.
    for (const candidate of [current, expected]) {
      for (const key of Array.from(candidate.searchParams.keys())) {
        if (key === 'email' || key.startsWith('utm_')) {
          candidate.searchParams.delete(key);
        }
      }
      candidate.searchParams.sort();
    }
    return (
      !current.username &&
      !current.password &&
      current.origin === expected.origin &&
      current.pathname === expected.pathname &&
      current.searchParams.toString() === expected.searchParams.toString()
    );
  } catch {
    return false;
  }
}

// Only replace a tab that still belongs to the recorded checkout.
async function isReusableCheckoutTab(
  tabId: number | undefined,
  checkoutUrl: string | undefined,
) {
  if (tabId === undefined || !checkoutUrl) return false;
  const tab = await getExtensionTab(tabId);
  return isMatchingCheckoutPageUrl(tab?.pendingUrl || tab?.url, checkoutUrl);
}

async function openExtensionCheckoutTab({
  session,
  url,
  replacedSession,
}: {
  session: IPrimeWebCheckoutPendingSession;
  url: string;
  replacedSession?: IPrimeWebCheckoutPendingSession;
}) {
  const browserSessionId = await extUtils.getBrowserSessionId();
  const usableExtension =
    await getUsablePrimeWebCheckoutExtensionContext(session);
  const initiator = usableExtension ?? (await getExtensionCheckoutInitiator());
  const currentTabId = usableExtension?.checkoutTabId;
  if (currentTabId !== undefined) {
    const currentTab = await getExtensionTab(currentTabId);
    const currentUrl = currentTab?.pendingUrl || currentTab?.url;
    // Chrome hides URL fields without tabs/host permission. Focusing our
    // recorded tab is safe and preserves any in-flight card or 3DS form.
    // Never rewrite an unknown URL or a tab visibly navigated elsewhere.
    if (
      currentTab &&
      (!currentUrl ||
        isMatchingCheckoutPageUrl(currentUrl, session.checkoutUrl)) &&
      (await extUtils.focusTab(currentTabId))
    ) {
      return;
    }
  }
  // Reuses the tab of this checkout, or of the checkout it replaces, so only
  // one hosted checkout stays open.
  const replacedTabId = replacedSession
    ? (await getUsablePrimeWebCheckoutExtensionContext(replacedSession))
        ?.checkoutTabId
    : undefined;
  let reusableTabId: number | undefined;
  if (
    await isReusableCheckoutTab(replacedTabId, replacedSession?.checkoutUrl)
  ) {
    reusableTabId = replacedTabId;
  }
  const checkoutTab = await extUtils.openUrlInTab(url, {
    tabId: reusableTabId,
  });
  if (checkoutTab?.id === undefined) {
    throw new OneKeyLocalError('Failed to open the checkout tab');
  }
  await backgroundApiProxy.simpleDb.prime.updateWebCheckoutPendingSessionExtensionContext(
    {
      onekeyUserId: session.onekeyUserId,
      checkoutId: session.checkoutId,
      extension: {
        ...initiator,
        checkoutTabId: checkoutTab.id,
        browserSessionId,
      },
    },
  );
}

// Opens (or reopens) the hosted checkout page. 'navigatedAway' means this
// page is unloading; the return page resumes the checkout.
export async function openPrimeWebCheckoutPage(
  session: IPrimeWebCheckoutPendingSession,
  { email, replacedSession }: IPrimeWebCheckoutOpenOptions = {},
): Promise<'opened' | 'navigatedAway'> {
  const url = withPrimeWebPurchaseLinkEmail(session.checkoutUrl, email);
  if (platformEnv.isExtension) {
    await openExtensionCheckoutTab({ session, url, replacedSession });
    return 'opened';
  }
  if (platformEnv.isDesktop) {
    // window.open is handed to the system browser by the desktop shell.
    openUrlUtils.openUrlExternal(url, {
      useSystemBrowser: true,
    });
    return 'opened';
  }
  if (platformEnv.isWeb && !platformEnv.isWebEmbed) {
    // Same-tab navigation is never blocked as a popup, even without a user
    // gesture (e.g. after an automatic fallback).
    globalThis.location.assign(url);
    return 'navigatedAway';
  }
  throw new OneKeyLocalError(
    'Hosted card checkout is not available on this platform',
  );
}
