import React, { ComponentProps, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { Text } from '@onekeyhq/components';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';

import { ITxActionAmountProps } from '../types';

import { TxActionElementPressable } from './TxActionElementPressable';

export function TxActionElementAmount(props: ITxActionAmountProps) {
  const { direction, amount, symbol, onPress, decimals, ...others } = props;
  const directionMeta = useMemo(() => {
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
  }, [direction]);

  const amountText = useMemo(() => {
    if (!isNil(decimals)) {
      return new BigNumber(amount).toFixed(decimals);
    }
    return amount;
  }, [amount, decimals]);

  return (
    <TxActionElementPressable onPress={onPress}>
      <Text color={directionMeta.color} {...others}>
        {directionMeta.sign}
        {amountText} {symbol}
      </Text>
    </TxActionElementPressable>
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
