/* cspell:ignore Infini */
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPrimeGiftAnalyticsSource } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeDarkDialogContainer } from '../../components/PrimeDarkDialogContainer';
import {
  PrimeRedemptionFormView,
  PrimeRedemptionSuccessView,
} from '../../components/PrimeRedemptionViews';
import { getPrimeInfiniPaymentEntryGuard } from '../../hooks/primeInfiniExternalCheckoutGuard';
import { usePrimeRedemptionSubmit } from '../../hooks/usePrimeRedemptionSubmit';
import { PrimeTestIDs } from '../../testIDs';

async function readInfiniPaymentEntryGuard() {
  try {
    return await getPrimeInfiniPaymentEntryGuard();
  } catch {
    // Probe failed: treat as not ready so redeem stays blocked.
    return undefined;
  }
}

type IPrimeRedemptionDialogParams = {
  expectedOneKeyUserId: string;
  isPrimeActiveBeforeRedeem: boolean;
  initialCode?: string;
  primeGiftSerialNo?: string;
  giftSource?: IPrimeGiftAnalyticsSource;
  onRedeemed?: (result: IPrimeRedemptionResult) => void;
};

function PrimeRedemptionDialogContent({
  expectedOneKeyUserId,
  isPrimeActiveBeforeRedeem,
  initialCode,
  primeGiftSerialNo,
  giftSource,
  onRedeemed,
}: IPrimeRedemptionDialogParams) {
  const intl = useIntl();
  const {
    codeValue,
    form,
    isSubmitting,
    redemptionResult,
    runWithSubmittingLock,
    submitRedemption,
  } = usePrimeRedemptionSubmit({
    expectedOneKeyUserId,
    isPrimeActiveBeforeRedeem,
    initialCode,
    primeGiftSerialNo,
    giftSource,
    onRedeemed,
  });
  const [isPendingPaymentConfirmation, setIsPendingPaymentConfirmation] =
    useState(false);

  const handleRedeem = useCallback(
    async (
      { close, preventClose }: IDialogInstance & { preventClose: () => void },
      options?: { skipPendingPaymentCheck?: boolean },
    ) => {
      preventClose();
      await runWithSubmittingLock(async () => {
        if (!options?.skipPendingPaymentCheck) {
          const entryGuard = await readInfiniPaymentEntryGuard();
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
        }

        await submitRedemption({ onExpiredSession: close });
        setIsPendingPaymentConfirmation(false);
      });
    },
    [expectedOneKeyUserId, form, intl, runWithSubmittingLock, submitRedemption],
  );

  if (redemptionResult) {
    return (
      <YStack mx="$-5" testID={PrimeTestIDs.redemptionSuccess}>
        <Dialog.Header />
        <YStack px="$5" pt="$2" pb="$5">
          <PrimeRedemptionSuccessView redemptionResult={redemptionResult} />
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
          onConfirm={(dialog) =>
            handleRedeem(dialog, { skipPendingPaymentCheck: true })
          }
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
      <YStack px="$5" py="$5">
        <PrimeRedemptionFormView
          form={form}
          isCodeReadOnly={Boolean(primeGiftSerialNo)}
        />
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

export function showPrimeRedemptionDialog(
  params: IPrimeRedemptionDialogParams,
): IDialogInstance {
  const renderContent = <PrimeRedemptionDialogContent {...params} />;
  const isHardwarePrimeGift = Boolean(params.primeGiftSerialNo);
  return Dialog.show({
    testID: 'prime-redemption-dialog',
    showFooter: false,
    renderContent,
    ...(isHardwarePrimeGift
      ? {
          dialogContainer: ({ ref }) => (
            <PrimeDarkDialogContainer
              ref={ref}
              testID="prime-redemption-dialog"
              showFooter={false}
              renderContent={renderContent}
              onClose={async () => undefined}
            />
          ),
        }
      : {}),
  });
}
