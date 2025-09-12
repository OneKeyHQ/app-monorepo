import { Fragment, useCallback } from 'react';

import BigNumber from 'bignumber.js';

import {
  Button,
  Divider,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import type { ISwapNativeTokenReserveGas } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection, type ITradeType } from '../../hooks/useTradeType';

export interface IQuickAmountSelectorProps {
  onSelect: (value: string) => void;
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
  const amountsLength = amounts.length;

  const handleAmountSelect = useCallback(
    (amount: { label: string; value: string | number }) => {
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
      tradeType,
      balance,
      swapNativeTokenReserveGas,
      selectedTokenIsNative,
      selectedTokenDecimals,
      onSelect,
      selectedTokenNetworkId,
    ],
  );

  if (amounts.length === 0) {
    return <Skeleton h="$8" w="100%" />;
  }

  return (
    <XStack gap="$0" h="$8">
      {amounts.map((amount, index) => (
        <Fragment key={`item-${amount.value}`}>
          <Button
            key={`button-${amount.value}`}
            flex={1}
            size="medium"
            variant="secondary"
            h="$8"
            borderTopRightRadius={index !== amountsLength - 1 ? 0 : '$2'}
            borderBottomRightRadius={index !== amountsLength - 1 ? 0 : '$2'}
            borderTopLeftRadius={index !== 0 ? 0 : '$2'}
            borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
            onPress={() => handleAmountSelect(amount)}
          >
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {amount.label}
            </SizableText>
          </Button>
          {index !== amountsLength - 1 ? (
            <Divider key={`divider-${index}`} vertical />
          ) : null}
        </Fragment>
      ))}
    </XStack>
  );
}
