import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { requestPrimeRedemption } from './requestPrimeRedemption';

export type IPrimeRedemptionFormValues = {
  code: string;
};

export function usePrimeRedemptionSubmit({
  expectedOneKeyUserId,
  initialCode = '',
  isPrimeActiveBeforeRedeem,
  onRedeemed,
}: {
  expectedOneKeyUserId: string | undefined;
  initialCode?: string;
  isPrimeActiveBeforeRedeem: boolean;
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

      const outcome = await requestPrimeRedemption({
        code: form.getValues('code'),
        expectedOneKeyUserId,
        isPrimeActiveBeforeRedeem,
        fallbackMessage: intl.formatMessage({
          id: ETranslations.redemption_invalid_code_error,
        }),
      });
      if (outcome.ok) {
        setRedemptionResult(outcome.result);
        onRedeemed?.(outcome.result);
        return;
      }
      if (outcome.presentation.isExpiredSession) {
        await onExpiredSession?.();
        return;
      }
      form.setError('code', { message: outcome.presentation.message });
    },
    [expectedOneKeyUserId, form, intl, isPrimeActiveBeforeRedeem, onRedeemed],
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
