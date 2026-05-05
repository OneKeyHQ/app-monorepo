import { Fragment, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Button, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ISwapNativeTokenReserveGas } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection, type ITradeType } from '../../hooks/useTradeType';

import type { IAmountEnterSource } from '../../types/analytics';

export interface IQuickAmountSelectorProps {
  onSelect: (value: string) => void;
  onPresetSelect?: (source: IAmountEnterSource) => void;
  tradeType: ITradeType;
  buyAmounts: { label: string; value: number }[];
  balance?: BigNumber;
  selectedTokenDecimals?: number;
  selectedTokenNetworkId?: string;
  selectedTokenIsNative?: boolean;
  swapNativeTokenReserveGas: ISwapNativeTokenReserveGas[];
}

const sellPercentages = [
  { label: '25%', value: '0.25' },
  { label: '50%', value: '0.5' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
];

export function QuickAmountSelector({
  onSelect,
  onPresetSelect,
  buyAmounts,
  tradeType,
  balance,
  selectedTokenDecimals,
  swapNativeTokenReserveGas,
  selectedTokenNetworkId,
  selectedTokenIsNative,
}: IQuickAmountSelectorProps) {
  const amounts =
    tradeType === ESwapDirection.BUY ? buyAmounts : sellPercentages;

  const handleAmountSelect = useCallback(
    (amount: { label: string; value: string | number }, index: number) => {
      // Track preset selection in analytics
      if (onPresetSelect) {
        const presetType = `preset${index + 1}` as IAmountEnterSource;
        onPresetSelect(presetType);
      }

      if (tradeType === ESwapDirection.SELL && balance) {
        if (balance.isZero()) {
          onSelect('0');
          return;
        }
        const percentageBN = new BigNumber(amount.value.toString());
        const reserveGas = swapNativeTokenReserveGas.find(
          (item) => item.networkId === selectedTokenNetworkId,
        )?.reserveGas;
        let calculatedAmountBN = balance.multipliedBy(percentageBN);
        if (selectedTokenIsNative && reserveGas) {
          calculatedAmountBN = BigNumber.max(
            0,
            calculatedAmountBN.minus(new BigNumber(reserveGas)),
          );
        }
        if (selectedTokenDecimals) {
          const calculatedAmount = calculatedAmountBN
            .decimalPlaces(selectedTokenDecimals, BigNumber.ROUND_DOWN)
            .toFixed();
          onSelect(calculatedAmount);
        } else {
          onSelect(calculatedAmountBN.toFixed());
        }
      } else {
        onSelect(amount.value.toString());
      }
    },
    [
      onPresetSelect,
      tradeType,
      balance,
      swapNativeTokenReserveGas,
      selectedTokenIsNative,
      selectedTokenDecimals,
      onSelect,
      selectedTokenNetworkId,
    ],
  );
  const amountItems = useMemo(() => {
    if (amounts.length === 0) {
      return [
        { label: '0.1', value: '0.1' },
        { label: '0.5', value: '0.5' },
        { label: '1', value: '1' },
        { label: '10', value: '10' },
      ];
    }
    return amounts;
  }, [amounts]);
  const amountsLength = amountItems.length;
  return (
    <XStack gap="$0" h="$8">
      {amountItems.map((amount, index) => (
        <Fragment key={`item-${amount.value}`}>
          <Button
            key={`button-${amount.value}`}
            flex={1}
            size="medium"
            variant="secondary"
            h="$8"
            borderWidth={0}
            bg="$bgStrong"
            borderTopRightRadius={0}
            borderBottomRightRadius={index !== amountsLength - 1 ? 0 : '$2'}
            borderTopLeftRadius={0}
            borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
            onPress={() => handleAmountSelect(amount, index)}
          >
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {amount.label}
            </SizableText>
          </Button>
          {index !== amountsLength - 1 ? (
            <Stack key={`divider-${index}`} w={1.5} bg="$bgApp" />
          ) : null}
        </Fragment>
      ))}
    </XStack>
  );
}
