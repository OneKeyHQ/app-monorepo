import {
  Divider,
  type IYStackProps,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  EAmountInputMode,
  type IAmountInputValues,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

type IAmountPreviewProps = {
  inDialog?: boolean;
  amountInputValues: IAmountInputValues;
  amountInputMode: EAmountInputMode;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  transfersInfo: ITransferInfo[];
  containerProps?: IYStackProps;
  // Mobile-specific props
  isInPreviewMode?: boolean;
  previewTotalTokenAmount?: string;
  previewTotalFiatAmount?: string;
};

export function AmountPreview({
  inDialog,
  amountInputValues,
  amountInputMode,
  tokenDetails,
  transfersInfo,
  isInPreviewMode,
  previewTotalTokenAmount,
  previewTotalFiatAmount,
  containerProps,
}: IAmountPreviewProps) {
  const [settings] = useSettingsPersistAtom();

  // Determine if we should show Total amount section
  const showTotalAmount = useMemo(() => {
    if (inDialog) {
      return amountInputMode === EAmountInputMode.Specified;
    }
    // Mobile mode logic:
    // - Specified mode: always show Total (real-time or preview)
    // - Range mode: only show Total when in preview mode
    // - Custom mode: always show Total
    if (amountInputMode === EAmountInputMode.Range) {
      return isInPreviewMode;
    }
    return true;
  }, [inDialog, amountInputMode, isInPreviewMode]);

  // Determine if we should show Available section
  // In preview mode for Specified/Range, hide Available
  const showAvailable = useMemo(() => {
    if (inDialog) {
      return true;
    }
    // Mobile mode: hide Available when in preview mode for Specified/Range
    if (isInPreviewMode && amountInputMode !== EAmountInputMode.Custom) {
      return false;
    }
    return true;
  }, [inDialog, isInPreviewMode, amountInputMode]);

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
    // For other modes, calculate from transfersInfo
    const total = transfersInfo.reduce(
      (acc, transfer) => acc.plus(transfer.amount || '0'),
      new BigNumber(0),
    );
    const totalTokenAmount = total.toFixed();
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
  ]);

  return (
    <YStack {...containerProps}>
      {showTotalAmount ? (
        <>
          <YStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              Total amount
            </SizableText>
            <XStack alignItems="center" gap="$1">
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: tokenDetails?.info.symbol }}
              >
                {totalTokenAmount}
              </NumberSizeableText>
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                (
                <NumberSizeableText
                  size="$bodyLgMedium"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  {totalFiatAmount}
                </NumberSizeableText>
                )
              </SizableText>
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
            <SizableText size="$bodyMd" color="$textSubdued">
              Available:
            </SizableText>
            <NumberSizeableText
              size="$bodyMd"
              formatter="balance"
              formatterOptions={{ tokenSymbol: tokenDetails?.info.symbol }}
            >
              {tokenDetails?.balanceParsed ?? '-'}
            </NumberSizeableText>
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  );
}
