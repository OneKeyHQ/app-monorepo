import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  type IYStackProps,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAmountInputMode,
  type IAmountInputError,
  type IAmountInputValues,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

type IAmountPreviewProps = {
  inDialog?: boolean;
  amountInputValues: IAmountInputValues;
  amountInputMode: EAmountInputMode;
  amountInputErrors?: IAmountInputError;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  transfersInfo: ITransferInfo[];
  containerProps?: IYStackProps;
  // Mobile-specific props
  isInPreviewMode?: boolean;
  previewTotalTokenAmount?: string;
  previewTotalFiatAmount?: string;
  rangePreviewAmounts?: string[];
  onMaxPress?: () => void;
  isInsufficientBalance?: boolean;
};

export function AmountPreview({
  inDialog,
  amountInputValues,
  amountInputMode,
  amountInputErrors,
  tokenDetails,
  transfersInfo,
  isInPreviewMode,
  previewTotalTokenAmount,
  previewTotalFiatAmount,
  rangePreviewAmounts,
  containerProps,
  onMaxPress,
  isInsufficientBalance,
}: IAmountPreviewProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  // Check if range has values (for showing the section)
  const hasRangeValues = useMemo(() => {
    if (amountInputMode !== EAmountInputMode.Range) return false;
    return (
      amountInputValues.rangeMin !== '' || amountInputValues.rangeMax !== ''
    );
  }, [amountInputMode, amountInputValues.rangeMin, amountInputValues.rangeMax]);

  // Check if range values are valid (no errors)
  const isRangeValid = useMemo(() => {
    if (amountInputMode !== EAmountInputMode.Range) return false;
    const hasErrors = !!amountInputErrors?.rangeError;
    const hasValues =
      amountInputValues.rangeMin !== '' && amountInputValues.rangeMax !== '';
    return !hasErrors && hasValues;
  }, [
    amountInputMode,
    amountInputErrors?.rangeError,
    amountInputValues.rangeMin,
    amountInputValues.rangeMax,
  ]);

  // Determine if we should show Total amount section
  const showTotalAmount = useMemo(() => {
    if (inDialog) {
      return amountInputMode === EAmountInputMode.Specified;
    }
    // Mobile mode logic:
    // - Specified mode: always show Total (real-time or preview)
    // - Range mode: show section when has values or in preview mode
    // - Custom mode: always show Total
    if (amountInputMode === EAmountInputMode.Range) {
      return isInPreviewMode || hasRangeValues;
    }
    return true;
  }, [inDialog, amountInputMode, isInPreviewMode, hasRangeValues]);

  // Determine if we should show Available section
  // In preview mode for Specified/Range, hide Available
  const showAvailable =
    inDialog || !isInPreviewMode || amountInputMode === EAmountInputMode.Custom;

  const { totalTokenAmount, totalFiatAmount } = useMemo(() => {
    // In preview mode, use pre-calculated values
    if (isInPreviewMode && previewTotalTokenAmount && previewTotalFiatAmount) {
      return {
        totalTokenAmount: previewTotalTokenAmount,
        totalFiatAmount: previewTotalFiatAmount,
      };
    }
    // Dialog mode calculation
    if (inDialog) {
      const totalTokenAmount = new BigNumber(
        amountInputValues.specifiedAmount || '0',
      )
        .times(transfersInfo.length)
        .toFixed();
      const totalFiatAmount = new BigNumber(totalTokenAmount)
        .times(tokenDetails?.price ?? 0)
        .toFixed();
      return { totalTokenAmount, totalFiatAmount };
    }
    // Mobile Specified mode (not in preview): calculate real-time from input
    if (amountInputMode === EAmountInputMode.Specified) {
      const totalTokenAmount = new BigNumber(
        amountInputValues.specifiedAmount || '0',
      )
        .times(transfersInfo.length)
        .toFixed();
      const totalFiatAmount = new BigNumber(totalTokenAmount)
        .times(tokenDetails?.price ?? 0)
        .toFixed();
      return { totalTokenAmount, totalFiatAmount };
    }
    // Mobile Range mode (not in preview): use pre-generated amounts
    if (amountInputMode === EAmountInputMode.Range && !isInPreviewMode) {
      // If range has errors or no preview amounts, show placeholder
      if (!isRangeValid || !rangePreviewAmounts?.length) {
        return { totalTokenAmount: '--', totalFiatAmount: '--' };
      }
      // Calculate total from pre-generated amounts
      const total = rangePreviewAmounts.reduce(
        (acc, amount) => acc.plus(amount || '0'),
        new BigNumber(0),
      );
      const totalTokenAmount = total.toFixed();
      const totalFiatAmount = total.times(tokenDetails?.price ?? 0).toFixed();
      return { totalTokenAmount, totalFiatAmount };
    }
    // For other modes, calculate from transfersInfo
    const total = transfersInfo.reduce(
      (acc, transfer) => acc.plus(transfer.amount || '0'),
      new BigNumber(0),
    );
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const totalTokenAmount = total.toFixed();
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const totalFiatAmount = total.times(tokenDetails?.price ?? 0).toFixed();
    return { totalTokenAmount, totalFiatAmount };
  }, [
    isInPreviewMode,
    previewTotalTokenAmount,
    previewTotalFiatAmount,
    amountInputValues.specifiedAmount,
    inDialog,
    tokenDetails?.price,
    transfersInfo,
    amountInputMode,
    isRangeValid,
    rangePreviewAmounts,
  ]);

  return (
    <YStack {...containerProps}>
      {showTotalAmount ? (
        <>
          <YStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_bulk_send_total_amount,
              })}
            </SizableText>
            <XStack alignItems="center" gap="$1">
              {totalTokenAmount === '--' ? (
                <SizableText size="$bodyLgMedium">--</SizableText>
              ) : (
                <>
                  <NumberSizeableText
                    size="$bodyLgMedium"
                    formatter="balance"
                    formatterOptions={{
                      tokenSymbol: tokenDetails?.info.symbol,
                    }}
                  >
                    {totalTokenAmount}
                  </NumberSizeableText>
                  <SizableText size="$bodyLgMedium" color="$textSubdued">
                    (
                    <NumberSizeableText
                      size="$bodyLgMedium"
                      formatter="value"
                      formatterOptions={{
                        currency: settings.currencyInfo.symbol,
                      }}
                    >
                      {totalFiatAmount}
                    </NumberSizeableText>
                    )
                  </SizableText>
                </>
              )}
            </XStack>
          </YStack>
          {showAvailable ? (
            <YStack pt="$3" pb="$2">
              <Divider />
            </YStack>
          ) : null}
        </>
      ) : null}
      {showAvailable ? (
        <XStack py="$0.5" alignItems="center" justifyContent="space-between">
          <XStack gap="$1" alignItems="center">
            <SizableText
              size="$bodyMd"
              color={isInsufficientBalance ? '$textCritical' : '$textSubdued'}
            >
              {intl.formatMessage({
                id: ETranslations.wallet_bulk_send_available,
              })}
            </SizableText>
            <NumberSizeableText
              size="$bodyMd"
              color={isInsufficientBalance ? '$textCritical' : '$text'}
              formatter="balance"
              formatterOptions={{ tokenSymbol: tokenDetails?.info.symbol }}
            >
              {tokenDetails?.balanceParsed ?? '-'}
            </NumberSizeableText>
          </XStack>
          {onMaxPress ? (
            <SizableText
              size="$bodyMdMedium"
              color="$textInteractive"
              cursor="default"
              onPress={onMaxPress}
              hitSlop={8}
            >
              {intl.formatMessage({ id: ETranslations.global_max })}
            </SizableText>
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
}
