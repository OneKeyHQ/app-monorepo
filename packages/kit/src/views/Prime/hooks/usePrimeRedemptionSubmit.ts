import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { getPrimeRedemptionErrorPresentation } from './primeRedemptionError';

export type IPrimeRedemptionFormValues = {
  code: string;
};

export function usePrimeRedemptionSubmit({
  expectedOneKeyUserId,
  initialCode = '',
  isPrimeActiveBeforeRedeem,
}: {
  expectedOneKeyUserId: string | undefined;
  initialCode?: string;
  isPrimeActiveBeforeRedeem: boolean;
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
        const result = await backgroundApiProxy.servicePrime.apiRedeemPrimeCode(
          {
            code: form.getValues('code').trim(),
            expectedOneKeyUserId,
          },
        );
        defaultLogger.prime.subscription.primeRedemptionResult({
          result: 'success',
          isPrimeActiveBeforeRedeem,
          addedDays: result.addedDays,
        });
        setRedemptionResult(result);
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
          result: 'failed',
          isPrimeActiveBeforeRedeem,
          errorCode: presentation.errorCode,
        });
        if (presentation.isExpiredSession) {
          await onExpiredSession?.();
          return;
        }
        form.setError('code', { message: presentation.message });
      }
    },
    [expectedOneKeyUserId, form, intl, isPrimeActiveBeforeRedeem],
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
