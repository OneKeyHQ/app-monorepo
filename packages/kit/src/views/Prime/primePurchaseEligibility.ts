import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showPrimeInfiniPaymentErrorToast } from './primeInfiniPaymentError';
import { logPrimeInfiniPaymentFlow } from './primeInfiniPaymentLogger';

import type { IntlShape } from 'react-intl';

let eligibilityRequest:
  | {
      expectedOneKeyUserId: string;
      promise: Promise<boolean>;
    }
  | undefined;

async function checkPrimePurchaseEligibility({
  expectedOneKeyUserId,
  intl,
}: {
  expectedOneKeyUserId: string;
  intl: IntlShape;
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
        title: intl.formatMessage({
          id: ETranslations.prime_onekey_id_session_changed__msg,
        }),
      });
      return false;
    }
    if (primeSubscription?.isActive) {
      Toast.message({
        title: intl.formatMessage({
          id: ETranslations.prime_already_active__msg,
        }),
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
      fallbackMessage: intl.formatMessage({
        id: ETranslations.prime_payment_start_failed__msg,
      }),
    });
    return false;
  }
}

export function ensurePrimePurchaseEligible({
  expectedOneKeyUserId,
  intl,
}: {
  expectedOneKeyUserId: string | undefined;
  intl: IntlShape;
}) {
  if (!expectedOneKeyUserId) {
    Toast.error({
      title: intl.formatMessage({
        id: ETranslations.prime_not_logged_in_description,
      }),
    });
    return Promise.resolve(false);
  }
  if (eligibilityRequest?.expectedOneKeyUserId === expectedOneKeyUserId) {
    return eligibilityRequest.promise;
  }
  const promise = checkPrimePurchaseEligibility({
    expectedOneKeyUserId,
    intl,
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
