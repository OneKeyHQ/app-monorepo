import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { Text, VStack } from '@onekeyhq/components';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';

import { formatBalanceDisplay } from '../../../components/Format';

import { TxActionElementPressable } from './TxActionElementPressable';

import type { ITxActionAmountProps } from '../types';

export function TxActionAmountMetaDataWithDirection(
  direction?: IDecodedTxDirection,
) {
  let sign = '';
  let color: string | undefined = 'text-default';
  if (
    direction === IDecodedTxDirection.SELF ||
    direction === IDecodedTxDirection.OUT
  ) {
    sign = '-';
    color = 'text-default';
  }
  if (direction === IDecodedTxDirection.IN) {
    sign = '+';
    color = 'text-success';
  }
  return {
    sign,
    color,
  };
}

export function TxActionElementAmount(props: ITxActionAmountProps) {
  const { direction, amount, symbol, onPress, decimals, subText, ...others } =
    props;
  const directionMeta = useMemo(
    () => TxActionAmountMetaDataWithDirection(direction),
    [direction],
  );

  const amountBN = useMemo(() => {
    if (amount) {
      return new BigNumber(amount);
    }
  }, [amount]);

  const amountText = useMemo((): string => {
    if (!amountBN || !amount) {
      return '';
    }
    if (!isNil(decimals) && !amountBN.isNaN()) {
      return (
        formatBalanceDisplay(amount, '', {
          fixed: decimals,
        })?.amount || amount
      );
    }
    return amount;
  }, [amount, amountBN, decimals]);

  const content = (
    <VStack flex="1">
      <Text
        testID="TxActionElementAmount"
        numberOfLines={2}
        isTruncated
        color={directionMeta.color}
        {...others}
      >
        {directionMeta.sign}
        {amountText} {symbol}
      </Text>
      {subText}
    </VStack>
  );
  return onPress ? (
    <TxActionElementPressable onPress={onPress} flex={1}>
      {content}
    </TxActionElementPressable>
  ) : (
    content
  );
}

export function TxActionElementAmountSmall(
  props: ComponentProps<typeof TxActionElementAmount>,
) {
  return <TxActionElementAmount typography="Body2" {...props} />;
}

export function TxActionElementAmountNormal(
  props: ComponentProps<typeof TxActionElementAmount>,
) {
  return <TxActionElementAmount typography="Body1Strong" {...props} />;
}

export function TxActionElementAmountLarge(
  props: ComponentProps<typeof TxActionElementAmount>,
) {
  return <TxActionElementAmount typography="DisplayXLarge" {...props} />;
}
