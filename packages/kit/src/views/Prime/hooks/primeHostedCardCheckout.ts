import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  PRIME_CARD_CHECKOUT_EXT_HANDOFF_CURRENCY_QUERY,
  PRIME_CARD_CHECKOUT_EXT_HANDOFF_FALLBACK_QUERY,
  PRIME_CARD_CHECKOUT_EXT_HANDOFF_FEATURE_QUERY,
  PRIME_CARD_CHECKOUT_EXT_HANDOFF_QUERY,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IPrimeWebCheckoutPendingSession } from '@onekeyhq/shared/types/prime/primeTypes';

import { showPrimeWebCheckoutWaitingDialog } from '../components/PrimeWebCheckoutWaitingDialog';
import { refreshPrimeUserInfoAfterPurchase } from '../primeSubscriptionPurchaseSuccess';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import primePaymentUtils from './primePaymentUtils';
import {
  fetchPrimeWebCheckoutEntitlement,
  getPrimeWebCheckoutPlatform,
  isPrimeWebCheckoutUserCurrent,
  logPrimeWebCheckoutFlow,
  openPrimeWebCheckoutPage,
  resolvePrimeWebCheckoutPackage,
} from './primeWebCheckout';
import {
  buildPrimeWebPurchaseLinkUrl,
  getPrimeWebPurchaseLinkConfig,
} from './primeWebPurchaseLink';

import type { ISubscriptionPeriod } from './usePrimePaymentTypes';
import type { IPrimeEmbeddedCheckoutFallbackTrigger } from '../purchasesSdk/primeEmbeddedCheckoutFallback';
import type { IntlShape } from 'react-intl';

export type IPrimeHostedCardCheckoutParams = {
  intl: IntlShape;
  onekeyUserId: string | undefined;
  email?: string;
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  currency?: string;
  featureName?: EPrimeFeatures;
  // Legacy bridge hint; package selection is independently resolved by the host.
  purchasePackage?: unknown;
  // Set when this checkout replaces a failed embedded Stripe checkout.
  fallbackFrom?: IPrimeEmbeddedCheckoutFallbackTrigger;
};

// The popup closes as soon as another tab takes focus, which would kill the
// waiting dialog, so card checkout continues in the expand tab with the same
// plan preselected. A fallback from the embedded checkout opens the hosted
// checkout there right away; otherwise the user confirms the plan again.
async function handOffCardCheckoutToExpandTab({
  selectedSubscriptionPeriod,
  currency,
  featureName,
  fallbackFrom,
}: {
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  currency?: string;
  featureName?: EPrimeFeatures;
  fallbackFrom?: IPrimeEmbeddedCheckoutFallbackTrigger;
}) {
  logPrimeWebCheckoutFlow({
    stage: 'extensionHandoff',
    status: 'started',
    reason: fallbackFrom,
    subscriptionPeriod: selectedSubscriptionPeriod,
    featureName,
  });
  await backgroundApiProxy.serviceApp.openExtensionExpandTab({
    path: '/',
    params: {
      [PRIME_CARD_CHECKOUT_EXT_HANDOFF_QUERY]: selectedSubscriptionPeriod,
      ...(featureName
        ? { [PRIME_CARD_CHECKOUT_EXT_HANDOFF_FEATURE_QUERY]: featureName }
        : {}),
      ...(fallbackFrom
        ? { [PRIME_CARD_CHECKOUT_EXT_HANDOFF_FALLBACK_QUERY]: fallbackFrom }
        : {}),
      ...(fallbackFrom && currency
        ? { [PRIME_CARD_CHECKOUT_EXT_HANDOFF_CURRENCY_QUERY]: currency }
        : {}),
    },
  });
  closeExtensionPopupAfterExpandTabOpen();
}

// Opens the RevenueCat hosted card checkout (Web Purchase Link) and waits for
// RevenueCat to confirm the purchase. Errors end in a toast, never a throw.
export async function startPrimeHostedCardCheckout({
  intl,
  onekeyUserId,
  email,
  selectedSubscriptionPeriod,
  currency,
  featureName,
  fallbackFrom,
}: IPrimeHostedCardCheckoutParams) {
  try {
    if (platformEnv.isExtensionUiPopup) {
      await handOffCardCheckoutToExpandTab({
        selectedSubscriptionPeriod,
        currency,
        featureName,
        fallbackFrom,
      });
      return;
    }

    if (fallbackFrom) {
      // The embedded attempt already logged its intent.
      logPrimeWebCheckoutFlow({
        stage: 'fallback',
        status: 'started',
        reason: fallbackFrom,
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
      });
    } else {
      defaultLogger.prime.subscription.primeSubscribeIntent({
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
        currency,
        paymentMethod: 'stripe',
        cardCheckoutFlow: 'hostedLink',
      });
    }
    if (!onekeyUserId) {
      throw new OneKeyLocalError('User not logged in');
    }
    const { isSandboxKey } = await getPrimePaymentApiKey({
      apiKeyType: 'web',
    });

    // Never open a second checkout for an active subscriber, e.g. a
    // purchase the server projection has not caught up with yet.
    const baselineEntitlement = await fetchPrimeWebCheckoutEntitlement({
      onekeyUserId,
      isSandbox: isSandboxKey,
    });
    if (baselineEntitlement?.isActive) {
      logPrimeWebCheckoutFlow({
        stage: 'baseline',
        status: 'blocked',
        reason: 'alreadyActive',
        isSandbox: isSandboxKey,
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName,
      });
      Toast.message({
        title: intl.formatMessage({
          id: ETranslations.prime_already_active__msg,
        }),
      });
      void refreshPrimeUserInfoAfterPurchase();
      return;
    }

    const config = getPrimeWebPurchaseLinkConfig({ isSandbox: isSandboxKey });
    const purchasePackage = await resolvePrimeWebCheckoutPackage({
      config,
      onekeyUserId,
      isSandbox: isSandboxKey,
      currency,
      subscriptionPeriod: selectedSubscriptionPeriod,
    });
    const platform = getPrimeWebCheckoutPlatform();
    const checkoutUrl = buildPrimeWebPurchaseLinkUrl({
      config,
      onekeyUserId,
      packageId: purchasePackage.packageId,
      // The sandbox offering is priced in USD only.
      currency: isSandboxKey ? undefined : purchasePackage.currency,
      platform,
      featureName,
    });

    if (!(await isPrimeWebCheckoutUserCurrent(onekeyUserId))) {
      throw new OneKeyLocalError('Prime purchase user changed');
    }
    const candidate: IPrimeWebCheckoutPendingSession = {
      checkoutId: generateUUID(),
      onekeyUserId,
      subscriptionPeriod: selectedSubscriptionPeriod,
      packageId: purchasePackage.packageId,
      offeringId: purchasePackage.offeringId,
      amount: purchasePackage.amount,
      currency: purchasePackage.currency,
      featureName,
      isSandbox: isSandboxKey,
      platform,
      checkoutUrl,
      startedAt: Date.now(),
    };
    // Independent extension surfaces must acquire the same payable session.
    const { session, reused, replacedSession } =
      await backgroundApiProxy.simpleDb.prime.acquireWebCheckoutPendingSession({
        session: candidate,
      });
    if (!(await isPrimeWebCheckoutUserCurrent(onekeyUserId))) {
      throw new OneKeyLocalError('Prime purchase user changed');
    }
    // Another surface may already be opening this session. Keep it recoverable
    // even when this caller fails to open or record its checkout tab.
    const openResult = await openPrimeWebCheckoutPage(session, {
      email,
      replacedSession,
    });
    logPrimeWebCheckoutFlow({
      stage: 'open',
      status: 'succeeded',
      reason: reused ? 'reusedCheckout' : undefined,
      isSandbox: isSandboxKey,
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
    });
    if (openResult === 'opened') {
      showPrimeWebCheckoutWaitingDialog({ session });
    }
  } catch (error) {
    logPrimeWebCheckoutFlow({
      stage: 'open',
      status: 'failed',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
    });
    primePaymentUtils.trackPrimeSubscriptionFailed({
      error,
      paymentMethod: 'stripe',
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName,
      cardCheckoutFlow: 'hostedLink',
    });
    Toast.error({
      title: intl.formatMessage({
        id: ETranslations.prime_payment_start_failed__msg,
      }),
    });
  }
}

function confirmPrimeHostedCardCheckoutFallback(intl: IntlShape) {
  return new Promise<boolean>((resolve) => {
    let confirmed = false;
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.prime_payment_start_failed__msg,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_complete_payment_in_browser__desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.prime_open_checkout__action,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
      onConfirm: () => {
        confirmed = true;
      },
      onClose: () => resolve(confirmed),
    });
  });
}

// Replaces a failed embedded Stripe checkout with the hosted Purchase Link:
// right away after an error, or on confirmation after a blank card form.
export async function fallbackToPrimeHostedCardCheckout({
  trigger,
  ...params
}: Omit<IPrimeHostedCardCheckoutParams, 'fallbackFrom'> & {
  trigger: IPrimeEmbeddedCheckoutFallbackTrigger;
}) {
  if (
    trigger === 'formNotLoaded' &&
    !(await confirmPrimeHostedCardCheckoutFallback(params.intl))
  ) {
    logPrimeWebCheckoutFlow({
      stage: 'fallback',
      status: 'cancelled',
      reason: trigger,
      subscriptionPeriod: params.selectedSubscriptionPeriod,
      featureName: params.featureName,
    });
    return;
  }
  await startPrimeHostedCardCheckout({ ...params, fallbackFrom: trigger });
}

// A hosted page may still accept payment after its waiting dialog closes.
// Resume that checkout instead of losing its monitor or starting a second one.
export async function resumePendingPrimeHostedCardCheckout(
  onekeyUserId: string | undefined,
): Promise<boolean> {
  if (!onekeyUserId) {
    return false;
  }
  const session =
    await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
      onekeyUserId,
    });
  if (!session) {
    return false;
  }
  if (!(await isPrimeWebCheckoutUserCurrent(onekeyUserId))) {
    throw new OneKeyLocalError('Prime purchase user changed');
  }
  showPrimeWebCheckoutWaitingDialog({ session });
  return true;
}

const FALLBACK_TRIGGERS = new Set<string>([
  'checkoutError',
  'formNotLoaded',
  'userRequestedHostedCheckout',
]);
const SUBSCRIPTION_PERIODS = new Set<string>(['P1Y', 'P1M']);
const PRIME_FEATURES = new Set<string>(Object.values(EPrimeFeatures));

// Android: the web-embed checkout page asks the native host to continue in
// the hosted checkout. The host pins identity, plan and currency to its route
// and independently resolves the RevenueCat package before opening the link.
export async function handlePrimeHostedCardCheckoutFallbackRequest({
  params,
  routePrimeUserId,
  routePrimeUserEmail,
  routeSubscriptionPeriod,
  routeCurrency,
  intl,
}: {
  params: unknown;
  routePrimeUserId: unknown;
  routePrimeUserEmail: unknown;
  routeSubscriptionPeriod: unknown;
  routeCurrency?: unknown;
  intl: IntlShape;
}) {
  const {
    trigger,
    onekeyUserId,
    subscriptionPeriod,
    featureName,
    purchasePackage,
  } = (params ?? {}) as Record<string, unknown>;
  if (
    typeof trigger !== 'string' ||
    !FALLBACK_TRIGGERS.has(trigger) ||
    typeof subscriptionPeriod !== 'string' ||
    !SUBSCRIPTION_PERIODS.has(subscriptionPeriod) ||
    subscriptionPeriod !== routeSubscriptionPeriod ||
    typeof routePrimeUserId !== 'string' ||
    !routePrimeUserId ||
    onekeyUserId !== routePrimeUserId
  ) {
    return;
  }
  await fallbackToPrimeHostedCardCheckout({
    trigger: trigger as IPrimeEmbeddedCheckoutFallbackTrigger,
    intl,
    onekeyUserId: routePrimeUserId,
    email:
      typeof routePrimeUserEmail === 'string' ? routePrimeUserEmail : undefined,
    selectedSubscriptionPeriod: subscriptionPeriod as ISubscriptionPeriod,
    currency: typeof routeCurrency === 'string' ? routeCurrency : undefined,
    featureName:
      typeof featureName === 'string' && PRIME_FEATURES.has(featureName)
        ? (featureName as EPrimeFeatures)
        : undefined,
    purchasePackage,
  });
}

async function getCurrentPlatformPendingSession() {
  const { isLoggedIn, onekeyUserId } =
    await backgroundApiProxy.servicePrime.getLocalUserInfo();
  if (!isLoggedIn || !onekeyUserId) {
    return undefined;
  }
  const session =
    await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
      onekeyUserId,
    });
  return session?.platform === getPrimeWebCheckoutPlatform()
    ? session
    : undefined;
}

// Desktop / Android: the onekey-wallet://prime_purchase_complete deep link
// only tells the waiting surface to re-check RevenueCat right away.
export async function notifyPrimeWebCheckoutReturned() {
  const session = await getCurrentPlatformPendingSession();
  if (!session) {
    return;
  }
  appEventBus.emitToSelf({
    type: EAppEventBusNames.PrimeWebCheckoutReturned,
    payload: { checkoutId: session.checkoutId },
    isRemote: false,
  });
}

// Web: the checkout replaced this page, so the return page resumes waiting.
export async function resumePrimeWebCheckoutAfterReturn(): Promise<boolean> {
  if (getPrimeWebCheckoutPlatform() !== 'web') {
    return false;
  }
  const session = await getCurrentPlatformPendingSession();
  if (!session) {
    return false;
  }
  logPrimeWebCheckoutFlow({
    stage: 'return',
    status: 'succeeded',
    isSandbox: session.isSandbox,
    subscriptionPeriod: session.subscriptionPeriod,
    featureName: session.featureName,
  });
  showPrimeWebCheckoutWaitingDialog({ session });
  return true;
}
