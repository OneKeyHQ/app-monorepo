import {
  Divider,
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
import { calculateTotalAmounts } from '../../../utils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

type IAmountPreviewProps = {
  inDialog?: boolean;
  amountInputValues: IAmountInputValues;
  amountInputMode: EAmountInputMode;
  tokenDetails: ({ info: IToken } & ITokenFiat) | undefined;
  transfersInfo: ITransferInfo[];
};

export function AmountPreview({
  inDialog,
  amountInputValues,
  amountInputMode,
  tokenDetails,
  transfersInfo,
}: IAmountPreviewProps) {

  const [settings] = useSettingsPersistAtom();

  const showTotalAmount = useMemo(() => {
    if (inDialog) {
      return amountInputMode === EAmountInputMode.Specified;
    }
    return amountInputMode !== EAmountInputMode.Custom;
  }, [inDialog, amountInputMode]);

  const { totalTokenAmount, totalFiatAmount } = useMemo(() => {
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
    return calculateTotalAmounts({
      transfersInfo,
      tokenPrice: tokenDetails?.price,
    });
  }, [
    amountInputValues.specifiedAmount,
    inDialog,
    tokenDetails?.price,
    transfersInfo,
  ]);

  return (
    <YStack>
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
          <YStack pt="$3" pb="$2">
            <Divider />
          </YStack>
        </>
      ) : null}
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
    </YStack>
  );
}
