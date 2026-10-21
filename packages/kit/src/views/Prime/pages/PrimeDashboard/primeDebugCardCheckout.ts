import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { getPrimePaymentApiKey } from '../../hooks/getPrimePaymentApiKey';
import { getPrimeCardCheckoutMode } from '../../hooks/primeCardCheckoutMode';
import primePaymentUtils from '../../hooks/primePaymentUtils';
import {
  assertPrimeWebCheckoutUserCurrent,
  getPrimeWebCheckoutPlatform,
  resolvePrimeWebCheckoutPackage,
} from '../../hooks/primeWebCheckout';
import {
  buildPrimeWebPurchaseLinkUrl,
  getPrimeWebPurchaseLinkConfig,
  withPrimeWebPurchaseLinkEmail,
} from '../../hooks/primeWebPurchaseLink';
import { refreshPrimeUserInfoAfterPurchase } from '../../primeSubscriptionPurchaseSuccess';
import { getPrimeEmbeddedCheckoutFallbackTrigger } from '../../purchasesSdk/primeEmbeddedCheckoutFallback';
import {
  beginStripePaymentElementAttempt,
  getStripePaymentElementState,
} from '../../purchasesSdk/stripePaymentElementHealth';

import type { IUsePrimePayment } from '../../hooks/usePrimePaymentTypes';

export async function startPrimeDebugCardCheckout({
  onekeyUserId,
  email,
  locale,
  purchasePackageWeb,
}: {
  onekeyUserId: string | undefined;
  email: string;
  locale: string;
  purchasePackageWeb: IUsePrimePayment['purchasePackageWeb'];
}) {
  if (!platformEnv.isDev || platformEnv.isNative || platformEnv.isMas) {
    throw new OneKeyLocalError(
      'Card payment testing requires a development build',
    );
  }
  if (!onekeyUserId || !purchasePackageWeb) {
    throw new OneKeyLocalError(
      'Sign in to OneKey ID before testing card payment',
    );
  }
  const { userInfo } =
    await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
      forceRefresh: true,
    });
  if (
    !userInfo.isLoggedIn ||
    !userInfo.isLoggedInOnServer ||
    userInfo.onekeyUserId !== onekeyUserId
  ) {
    throw new OneKeyLocalError('Prime purchase user changed');
  }
  const pendingSession =
    await backgroundApiProxy.simpleDb.prime.getWebCheckoutPendingSession({
      onekeyUserId,
    });
  if (pendingSession) {
    throw new OneKeyLocalError(
      'Complete the pending hosted checkout before starting a debug payment',
    );
  }
  await assertPrimeWebCheckoutUserCurrent(onekeyUserId);

  const openHostedCheckout = async () => {
    const { isSandboxKey } = await getPrimePaymentApiKey({ apiKeyType: 'web' });
    const config = getPrimeWebPurchaseLinkConfig({ isSandbox: isSandboxKey });
    const purchasePackage = await resolvePrimeWebCheckoutPackage({
      config,
      onekeyUserId,
      isSandbox: isSandboxKey,
      subscriptionPeriod: 'P1Y',
    });
    await assertPrimeWebCheckoutUserCurrent(onekeyUserId);
    const checkoutUrl = buildPrimeWebPurchaseLinkUrl({
      config,
      onekeyUserId,
      packageId: purchasePackage.packageId,
      currency: isSandboxKey ? undefined : purchasePackage.currency,
      platform: getPrimeWebCheckoutPlatform(),
    });
    // Existing Prime must not settle a test checkout as a successful payment.
    // Open the real card page without creating a monitored pending session.
    const url = withPrimeWebPurchaseLinkEmail(checkoutUrl, email);
    if (platformEnv.isWeb) {
      // Account/package requests can outlive the browser's popup activation.
      globalThis.location.assign(url);
    } else {
      openUrlUtils.openUrlExternal(url);
    }
  };

  if ((await getPrimeCardCheckoutMode()) === 'hostedLink') {
    await openHostedCheckout();
    return;
  }

  beginStripePaymentElementAttempt();
  try {
    // Only this development entry skips the existing-Prime eligibility gate.
    await purchasePackageWeb({ subscriptionPeriod: 'P1Y', email, locale });
  } catch (error) {
    const trigger = getPrimeEmbeddedCheckoutFallbackTrigger({
      error,
      paymentElementState: getStripePaymentElementState(),
    });
    if (
      trigger !== 'userRequestedHostedCheckout' &&
      primePaymentUtils.classifyPurchaseError(error).reason === 'userCancelled'
    ) {
      return;
    }
    if (trigger) {
      await openHostedCheckout();
      return;
    }
    throw error;
  }
  await assertPrimeWebCheckoutUserCurrent(onekeyUserId);
  await refreshPrimeUserInfoAfterPurchase();
}
