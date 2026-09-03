/* cspell:ignore Infini */
import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  Form,
  Icon,
  Input,
  LottieView,
  SizableText,
  Stack,
  UnOrderedList,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { getPrimeInfiniPaymentEntryGuard } from '../../hooks/primeInfiniExternalCheckoutGuard';
import { PrimeTestIDs } from '../../testIDs';

type IPrimeRedemptionFormValues = {
  code: string;
};

function PrimeRedemptionDialogContent({
  expectedOneKeyUserId,
  isPrimeActiveBeforeRedeem,
}: {
  expectedOneKeyUserId: string;
  isPrimeActiveBeforeRedeem: boolean;
}) {
  const intl = useIntl();
  const form = useForm<IPrimeRedemptionFormValues>({
    defaultValues: { code: '' },
    mode: 'onChange',
  });
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPendingPaymentConfirmation, setIsPendingPaymentConfirmation] =
    useState(false);
  const [redemptionResult, setRedemptionResult] =
    useState<IPrimeRedemptionResult>();
  const codeValue = form.watch('code');
  const themeName = useThemeName() as 'light' | 'dark';
  const primeIconName =
    themeName === 'light'
      ? 'OnekeyPrimeLightColored'
      : 'OnekeyPrimeDarkColored';
  const redemptionCodeLabel = intl.formatMessage({
    id: ETranslations.redemption_enter_code_placeholder,
  });

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
      code,
      close,
    }: {
      code: string;
      close: IDialogInstance['close'];
    }) => {
      try {
        const result = await backgroundApiProxy.servicePrime.apiRedeemPrimeCode(
          {
            code,
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
          .catch(() => undefined);
      } catch (error) {
        setIsPendingPaymentConfirmation(false);
        const apiError = error as {
          code?: unknown;
          data?: {
            code?: unknown;
            message?: unknown;
            translatedMessage?: unknown;
          };
          key?: unknown;
          message?: unknown;
          response?: {
            data?: {
              code?: unknown;
              message?: unknown;
              translatedMessage?: unknown;
            };
          };
        };
        const responseData = apiError.response?.data;
        const translatedMessage =
          apiError.data?.translatedMessage ?? responseData?.translatedMessage;
        const serverMessage = apiError.data?.message ?? responseData?.message;
        const errorCodeCandidate =
          apiError.data?.code ?? responseData?.code ?? apiError.code;
        const errorCode =
          Number.isSafeInteger(errorCodeCandidate) &&
          Number(errorCodeCandidate) > 0
            ? Number(errorCodeCandidate)
            : undefined;
        defaultLogger.prime.subscription.primeRedemptionResult({
          result: 'failed',
          isPrimeActiveBeforeRedeem,
          errorCode,
        });
        if (apiError.key === ETranslations.id_login_expired_description) {
          await close();
          return;
        }
        form.setError('code', {
          message:
            (typeof translatedMessage === 'string' && translatedMessage) ||
            (typeof serverMessage === 'string' && serverMessage) ||
            (typeof apiError.message === 'string' && apiError.message) ||
            intl.formatMessage({
              id: ETranslations.redemption_invalid_code_error,
            }),
        });
      }
    },
    [expectedOneKeyUserId, form, intl, isPrimeActiveBeforeRedeem],
  );

  const handleRedeem = useCallback(
    async ({
      close,
      preventClose,
    }: IDialogInstance & { preventClose: () => void }) => {
      preventClose();
      const code = form.getValues('code').trim();
      if (!code) {
        return;
      }

      await runWithSubmittingLock(async () => {
        let entryGuard:
          | Awaited<ReturnType<typeof getPrimeInfiniPaymentEntryGuard>>
          | undefined;
        try {
          entryGuard = await getPrimeInfiniPaymentEntryGuard();
        } catch {
          entryGuard = undefined;
        }
        if (
          !entryGuard?.isLoggedIn ||
          entryGuard.onekeyUserId !== expectedOneKeyUserId
        ) {
          form.setError('code', {
            message: intl.formatMessage({
              id: ETranslations.global_unknown_error_retry_message,
            }),
          });
          return;
        }
        if (entryGuard.hasPendingPayment) {
          setIsPendingPaymentConfirmation(true);
          return;
        }

        await submitRedemption({ code, close });
      });
    },
    [expectedOneKeyUserId, form, intl, runWithSubmittingLock, submitRedemption],
  );

  const handleConfirmedRedeem = useCallback(
    async ({
      close,
      preventClose,
    }: IDialogInstance & { preventClose: () => void }) => {
      preventClose();
      const code = form.getValues('code').trim();
      if (!code) {
        return;
      }
      await runWithSubmittingLock(() => submitRedemption({ code, close }));
    },
    [form, runWithSubmittingLock, submitRedemption],
  );

  if (redemptionResult) {
    const successTitle = intl.formatMessage({
      id: ETranslations.redemption_success_title,
    });
    const receivedDaysMessage = intl.formatMessage(
      {
        id: ETranslations.prime_redemption_received_days__msg,
      },
      { count: redemptionResult.addedDays },
    );
    const validUntilMessage = intl.formatMessage(
      {
        id: ETranslations.prime_membership_valid_until__desc,
      },
      {
        date: formatDateFns(new Date(redemptionResult.finalExpiresAt)),
      },
    );

    return (
      <YStack mx="$-5" testID={PrimeTestIDs.redemptionSuccess}>
        <Dialog.Header />
        <YStack
          px="$5"
          pt="$2"
          pb="$5"
          alignItems="center"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${successTitle} ${receivedDaysMessage} ${validUntilMessage}`}
        >
          <LottieView
            source={require('@onekeyhq/kit/assets/animations/lottie-swap-done.json')}
            width={110}
            height={110}
            autoPlay
            loop={false}
          />
          <SizableText size="$headingXl" textAlign="center" mt="$-2">
            {successTitle}
          </SizableText>
          <YStack
            mt="$5"
            width="100%"
            px="$4"
            py="$4"
            gap="$1.5"
            alignItems="center"
            bg="$brand2"
            borderRadius="$3"
            borderCurve="continuous"
          >
            <Icon name={primeIconName} size="$6" />
            <SizableText size="$headingMd" textAlign="center">
              {receivedDaysMessage}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {validUntilMessage}
            </SizableText>
          </YStack>
        </YStack>
        <Dialog.Footer
          showCancelButton={false}
          onConfirmText={intl.formatMessage({
            id: ETranslations.redemption_done_button,
          })}
        />
      </YStack>
    );
  }

  if (isPendingPaymentConfirmation) {
    return (
      <YStack mx="$-5">
        <Dialog.Header
          title={intl.formatMessage({
            id: ETranslations.prime_redeem_pending_payment__title,
          })}
          description={intl.formatMessage({
            id: ETranslations.prime_redeem_pending_payment__desc,
          })}
        />
        <Dialog.Footer
          showCancelButton
          cancelButtonProps={{
            onPress: () => setIsPendingPaymentConfirmation(false),
          }}
          onCancelText={intl.formatMessage({
            id: ETranslations.global_back,
          })}
          onConfirm={handleConfirmedRedeem}
          onConfirmText={intl.formatMessage({
            id: ETranslations.prime_redeem_anyway__action,
          })}
          confirmButtonProps={{ loading: isSubmitting }}
        />
      </YStack>
    );
  }

  return (
    <YStack mx="$-5">
      <Dialog.Header />
      <YStack px="$5" py="$5" alignItems="center">
        <Stack
          w="$16"
          h="$16"
          bg="$brand3"
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          mb="$5"
        >
          <Icon name={primeIconName} size="$10" />
        </Stack>
        <SizableText size="$headingXl" textAlign="center" mb="$5">
          {intl.formatMessage({
            id: ETranslations.prime_redeem__action,
          })}
        </SizableText>
        <YStack width="100%">
          <Form form={form}>
            <Form.Field
              name="code"
              description={
                <UnOrderedList width="100%" pt="$2">
                  <UnOrderedList.Item titleSize="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.prime_redemption_codes_cumulative__desc,
                    })}
                  </UnOrderedList.Item>
                  <UnOrderedList.Item titleSize="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.prime_redemption_paid_subscription_blocked__desc,
                    })}
                  </UnOrderedList.Item>
                </UnOrderedList>
              }
            >
              <Input
                testID={PrimeTestIDs.redemptionCodeInput}
                size="large"
                accessibilityLabel={redemptionCodeLabel}
                placeholder={redemptionCodeLabel}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </Form.Field>
          </Form>
        </YStack>
      </YStack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirm={handleRedeem}
        onConfirmText={intl.formatMessage({
          id: ETranslations.redemption_redeem_button,
        })}
        confirmButtonProps={{
          disabled: !codeValue?.trim() || isSubmitting,
          loading: isSubmitting,
        }}
      />
    </YStack>
  );
}

export function showPrimeRedemptionDialog({
  expectedOneKeyUserId,
  isPrimeActiveBeforeRedeem,
}: {
  expectedOneKeyUserId: string;
  isPrimeActiveBeforeRedeem: boolean;
}): IDialogInstance {
  return Dialog.show({
    showFooter: false,
    renderContent: (
      <PrimeRedemptionDialogContent
        expectedOneKeyUserId={expectedOneKeyUserId}
        isPrimeActiveBeforeRedeem={isPrimeActiveBeforeRedeem}
      />
    ),
  });
}
