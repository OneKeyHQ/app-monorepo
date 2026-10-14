import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  type IPrimeRedemptionErrorPresentation,
  getPrimeRedemptionErrorPresentation,
} from './primeRedemptionError';

export type IPrimeRedemptionRequestResult =
  | { ok: true; result: IPrimeRedemptionResult }
  | { ok: false; presentation: IPrimeRedemptionErrorPresentation };

function redemptionFailureResult(
  giftSource: IPrimeGiftAnalyticsSource | undefined,
  presentation: IPrimeRedemptionErrorPresentation,
) {
  if (
    giftSource &&
    presentation.errorCode === undefined &&
    !presentation.isExpiredSession &&
    !presentation.isLocalPreflightFailure
  ) {
    return 'unknown' as const;
  }
  return 'failed' as const;
}

export async function requestPrimeRedemption({
  code,
  expectedOneKeyUserId,
  isPrimeActiveBeforeRedeem,
  primeGiftSerialNo,
  giftSource,
  fallbackMessage,
}: {
  code: string;
  expectedOneKeyUserId: string;
  isPrimeActiveBeforeRedeem: boolean;
  primeGiftSerialNo?: string;
  giftSource?: IPrimeGiftAnalyticsSource;
  fallbackMessage: string;
}): Promise<IPrimeRedemptionRequestResult> {
  const giftAnalytics = giftSource
    ? { source: giftSource, entry: 'primeGift' as const }
    : {};
  try {
    if (giftSource) {
      defaultLogger.prime.subscription.primeGiftStage({
        source: giftSource,
        stage: 'claim',
        status: 'submit',
      });
    }
    const result = await backgroundApiProxy.servicePrime.apiRedeemPrimeCode({
      code: code.trim(),
      expectedOneKeyUserId,
      ...(primeGiftSerialNo ? { primeGiftSerialNo } : {}),
    });
    defaultLogger.prime.subscription.primeRedemptionResult({
      result: 'success',
      isPrimeActiveBeforeRedeem,
      addedDays: result.addedDays,
      ...giftAnalytics,
    });
    void backgroundApiProxy.servicePrime
      .apiFetchPrimeUserInfo({ forceRefresh: true })
      .catch(() => undefined); // best-effort persist refresh; success UI is already shown
    return { ok: true, result };
  } catch (error) {
    const presentation = getPrimeRedemptionErrorPresentation({
      error,
      fallbackMessage,
    });
    defaultLogger.prime.subscription.primeRedemptionResult({
      result: redemptionFailureResult(giftSource, presentation),
      isPrimeActiveBeforeRedeem,
      errorCode: presentation.errorCode,
      ...giftAnalytics,
    });
    return { ok: false, presentation };
  }
}
