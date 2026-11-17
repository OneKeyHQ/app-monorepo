import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeWebCheckoutFlowParams } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeWebCheckoutPendingSession,
  IPrimeWebCheckoutPlatform,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  finishPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
  refreshPrimeUserInfoAfterPurchase,
} from '../primeSubscriptionPurchaseSuccess';

import primePaymentUtils from './primePaymentUtils';
import { fetchPrimeWebCheckoutEntitlement } from './primeWebCheckoutPlatform';
import { evaluatePrimeWebCheckoutResult } from './primeWebCheckoutResult';

import type { IPrimeWebCheckoutResult } from './primeWebCheckoutResult';
import type { IPrimeSubscriptionPurchaseSuccessPayload } from '../primeSubscriptionPurchaseSuccess';
import type { IntlShape } from 'react-intl';

export const PRIME_WEB_CHECKOUT_WAITING_TIMEOUT_MS = 30 * 60 * 1000;
// Server projection lags behind the RevenueCat webhook; keep refreshing for
// about two minutes after RevenueCat confirmed the purchase.
const SERVER_REFRESH_DELAYS_MS = [3000, 5000, 10_000, 20_000, 30_000, 50_000];

export function getPrimeWebCheckoutPlatform(): IPrimeWebCheckoutPlatform {
  if (platformEnv.isExtension) {
    return 'extension';
  }
  if (platformEnv.isDesktop) {
    return 'desktop';
  }
  if (platformEnv.isNativeAndroid) {
    return 'android';
  }
  return 'web';
}

export function logPrimeWebCheckoutFlow(
  params: Omit<IPrimeWebCheckoutFlowParams, 'platform'>,
) {
  try {
    defaultLogger.prime.subscription.primeWebCheckoutFlow({
      ...params,
      platform: getPrimeWebCheckoutPlatform(),
    });
  } catch {
    // Observability must never break checkout.
  }
}

export function logPrimeWebCheckoutSessionFlow({
  session,
  ...params
}: Omit<
  IPrimeWebCheckoutFlowParams,
  'platform' | 'isSandbox' | 'subscriptionPeriod' | 'featureName'
> & {
  session: IPrimeWebCheckoutPendingSession;
}) {
  logPrimeWebCheckoutFlow({
    ...params,
    isSandbox: session.isSandbox,
    subscriptionPeriod: session.subscriptionPeriod,
    featureName: session.featureName,
  });
}

// Checkouts with a live waiting dialog in this runtime. Background recovery
// skips them so the dialog owns the result.
const monitoredCheckoutIds = new Set<string>();

export function markPrimeWebCheckoutMonitored(checkoutId: string) {
  monitoredCheckoutIds.add(checkoutId);
  return () => {
    monitoredCheckoutIds.delete(checkoutId);
  };
}

export function isPrimeWebCheckoutMonitored(checkoutId: string) {
  return monitoredCheckoutIds.has(checkoutId);
}

export async function isPrimeWebCheckoutUserCurrent(onekeyUserId: string) {
  const currentUser = await backgroundApiProxy.servicePrime.getLocalUserInfo();
  return Boolean(
    currentUser.isLoggedIn && currentUser.onekeyUserId === onekeyUserId,
  );
}

export async function assertPrimeWebCheckoutUserCurrent(onekeyUserId: string) {
  if (!(await isPrimeWebCheckoutUserCurrent(onekeyUserId))) {
    throw new OneKeyLocalError('Prime purchase user changed');
  }
}

// The OneKey ID can change while RevenueCat answers, so the purchase user is
// checked on both sides of the request.
export async function checkPrimeWebCheckout(
  session: IPrimeWebCheckoutPendingSession,
): Promise<IPrimeWebCheckoutResult> {
  await assertPrimeWebCheckoutUserCurrent(session.onekeyUserId);
  const entitlement = await fetchPrimeWebCheckoutEntitlement({
    onekeyUserId: session.onekeyUserId,
    isSandbox: session.isSandbox,
  });
  await assertPrimeWebCheckoutUserCurrent(session.onekeyUserId);
  return evaluatePrimeWebCheckoutResult({ session, entitlement });
}

export type IPrimeWebCheckoutSettlement =
  | {
      outcome: 'succeeded';
      successPayload: IPrimeSubscriptionPurchaseSuccessPayload;
    }
  | { outcome: 'activatedElsewhere' };

// Clears the pending checkout and reports its result. Only the caller that
// clears the session settles it, so the result is reported exactly once even
// when several extension surfaces poll the same checkout. The caller shows
// the success UI and then runs finishPrimeWebCheckoutSuccess.
export async function settlePrimeWebCheckout({
  session,
  result,
  intl,
}: {
  session: IPrimeWebCheckoutPendingSession;
  result: Exclude<IPrimeWebCheckoutResult, { status: 'pending' }>;
  intl: IntlShape;
}): Promise<IPrimeWebCheckoutSettlement | undefined> {
  // Never settle a checkout for a OneKey ID that has since logged out.
  await assertPrimeWebCheckoutUserCurrent(session.onekeyUserId);
  const didClear =
    await backgroundApiProxy.simpleDb.prime.clearWebCheckoutPendingSession({
      onekeyUserId: session.onekeyUserId,
      expectedCheckoutId: session.checkoutId,
    });
  if (!didClear) {
    return undefined;
  }
  logPrimeWebCheckoutSessionFlow({
    session,
    stage: 'settle',
    status: result.status === 'succeeded' ? 'succeeded' : 'blocked',
    reason: result.status === 'succeeded' ? undefined : 'activatedElsewhere',
    periodType: result.entitlement.periodType,
  });
  if (result.status === 'activatedElsewhere') {
    Toast.message({
      title: intl.formatMessage({
        id: ETranslations.prime_already_active__msg,
      }),
    });
    void refreshPrimeUserInfoAfterPurchase();
    return { outcome: 'activatedElsewhere' };
  }
  primePaymentUtils.trackPrimeSubscriptionSuccess({
    amount: session.amount,
    currency: session.currency,
    subscriptionPeriod: session.subscriptionPeriod,
    featureName: session.featureName as EPrimeFeatures | undefined,
    paymentMethod: 'stripe',
    cardCheckoutFlow: 'hostedLink',
    periodType: result.entitlement.periodType,
  });
  const successPayload = await preparePrimeSubscriptionPurchaseSuccess(
    session.onekeyUserId,
  );
  return { outcome: 'succeeded', successPayload };
}

export function showPrimeWebCheckoutSuccessToast(intl: IntlShape) {
  Toast.success({
    title: intl.formatMessage({
      id: ETranslations.prime_payment_successful,
    }),
    message: intl.formatMessage({
      id: ETranslations.prime_payment_successful_description,
    }),
  });
}

export async function finishPrimeWebCheckoutSuccess(
  successPayload: IPrimeSubscriptionPurchaseSuccessPayload,
) {
  await finishPrimeSubscriptionPurchaseSuccess(successPayload);
  void (async () => {
    for (const delayMs of SERVER_REFRESH_DELAYS_MS) {
      try {
        const { isActive } =
          (await backgroundApiProxy.servicePrime.getLocalUserInfo())
            .primeSubscription ?? {};
        if (isActive) {
          return;
        }
      } catch {
        // A failed status read must not end the refresh retries.
      }
      await timerUtils.wait(delayMs);
      try {
        await refreshPrimeUserInfoAfterPurchase();
      } catch {
        // Retried on the next delay.
      }
    }
  })();
}

export {
  fetchPrimeWebCheckoutEntitlement,
  isPrimeWebCheckoutInitiatorSurface,
  openPrimeWebCheckoutPage,
  resolvePrimeWebCheckoutPackage,
} from './primeWebCheckoutPlatform';
