import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { getPrimeRedemptionErrorPresentation } from './primeRedemptionError';

export type IPrimeRedemptionFormValues = {
  code: string;
};

export function usePrimeRedemptionSubmit({
  expectedOneKeyUserId,
  initialCode = '',
  isPrimeActiveBeforeRedeem,
  primeGiftSerialNo,
  giftSource,
  onRedeemed,
}: {
  expectedOneKeyUserId: string | undefined;
  initialCode?: string;
  isPrimeActiveBeforeRedeem: boolean;
  primeGiftSerialNo?: string;
  giftSource?: IPrimeGiftAnalyticsSource;
  onRedeemed?: (result: IPrimeRedemptionResult) => void;
}) {
  const intl = useIntl();
  const form = useForm<IPrimeRedemptionFormValues>({
    defaultValues: { code: initialCode },
    mode: 'onChange',
  });
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redemptionResult, setRedemptionResult] =
    useState<IPrimeRedemptionResult>();
  const codeValue = form.watch('code');

  const runWithSubmittingLock = useCallback(
    async (action: () => Promise<void>) => {
      if (isSubmittingRef.current) {
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      form.clearErrors('code');
      try {
        await action();
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [form],
  );

  const submitRedemption = useCallback(
    async ({
      onExpiredSession,
    }: {
      onExpiredSession?: () => void | Promise<void>;
    } = {}) => {
      if (!expectedOneKeyUserId) {
        return;
      }

      try {
        if (giftSource) {
          defaultLogger.prime.subscription.primeGiftStage({
            source: giftSource,
            stage: 'claim',
            status: 'submit',
          });
        }
        const result = await backgroundApiProxy.servicePrime.apiRedeemPrimeCode(
          {
            code: form.getValues('code').trim(),
            expectedOneKeyUserId,
            ...(primeGiftSerialNo ? { primeGiftSerialNo } : {}),
          },
        );
        defaultLogger.prime.subscription.primeRedemptionResult({
          result: 'success',
          isPrimeActiveBeforeRedeem,
          addedDays: result.addedDays,
          ...(giftSource
            ? { source: giftSource, entry: 'primeGift' as const }
            : {}),
        });
        setRedemptionResult(result);
        onRedeemed?.(result);
        void backgroundApiProxy.servicePrime
          .apiFetchPrimeUserInfo({ forceRefresh: true })
          .catch(() => undefined); // best-effort persist refresh; success UI is already shown
      } catch (error) {
        const presentation = getPrimeRedemptionErrorPresentation({
          error,
          fallbackMessage: intl.formatMessage({
            id: ETranslations.redemption_invalid_code_error,
          }),
        });
        defaultLogger.prime.subscription.primeRedemptionResult({
          result:
            giftSource &&
            presentation.errorCode === undefined &&
            !presentation.isExpiredSession &&
            !presentation.isLocalPreflightFailure
              ? 'unknown'
              : 'failed',
          isPrimeActiveBeforeRedeem,
          errorCode: presentation.errorCode,
          ...(giftSource
            ? { source: giftSource, entry: 'primeGift' as const }
            : {}),
        });
        if (presentation.isExpiredSession) {
          await onExpiredSession?.();
          return;
        }
        form.setError('code', { message: presentation.message });
      }
    },
    [
      expectedOneKeyUserId,
      form,
      intl,
      isPrimeActiveBeforeRedeem,
      primeGiftSerialNo,
      giftSource,
      onRedeemed,
    ],
  );

  return {
    codeValue,
    form,
    isSubmitting,
    redemptionResult,
    runWithSubmittingLock,
    submitRedemption,
  };
}
