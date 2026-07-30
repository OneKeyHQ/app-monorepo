import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { showPrimeInfiniPaymentErrorToast } from './primeInfiniPaymentError';
import { logPrimeInfiniPaymentFlow } from './primeInfiniPaymentLogger';

let eligibilityRequest:
  | {
      expectedOneKeyUserId: string;
      promise: Promise<boolean>;
    }
  | undefined;

async function checkPrimePurchaseEligibility({
  expectedOneKeyUserId,
}: {
  expectedOneKeyUserId: string;
}) {
  try {
    const { userInfo, primeSubscription } =
      await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
        forceRefresh: true,
      });
    if (
      !userInfo.isLoggedIn ||
      !userInfo.isLoggedInOnServer ||
      userInfo.onekeyUserId !== expectedOneKeyUserId
    ) {
      Toast.error({
        // TODO: i18n pending translation key
        title: 'Your OneKey ID session has changed. Please try again.',
      });
      return false;
    }
    if (primeSubscription?.isActive) {
      Toast.message({
        // TODO: i18n pending translation key
        title: 'OneKey Prime is already active for this account.',
      });
      return false;
    }
    return true;
  } catch (error) {
    logPrimeInfiniPaymentFlow({
      stage: 'paymentContext',
      status: 'failed',
      reason: 'purchaseEligibilityCheckFailed',
      error,
    });
    showPrimeInfiniPaymentErrorToast({
      error,
      fallbackMessage: 'Unable to verify purchase eligibility',
    });
    return false;
  }
}

export function ensurePrimePurchaseEligible({
  expectedOneKeyUserId,
}: {
  expectedOneKeyUserId: string | undefined;
}) {
  if (!expectedOneKeyUserId) {
    Toast.error({
      // TODO: i18n pending translation key
      title: 'Please log in to your OneKey ID first.',
    });
    return Promise.resolve(false);
  }
  if (eligibilityRequest?.expectedOneKeyUserId === expectedOneKeyUserId) {
    return eligibilityRequest.promise;
  }
  const promise = checkPrimePurchaseEligibility({
    expectedOneKeyUserId,
  }).finally(() => {
    if (eligibilityRequest?.promise === promise) {
      eligibilityRequest = undefined;
    }
  });
  eligibilityRequest = {
    expectedOneKeyUserId,
    promise,
  };
  return promise;
}
