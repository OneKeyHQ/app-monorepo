import React, { ComponentProps, useMemo } from 'react';

import { Text } from '@onekeyhq/components';
import { IDecodedTxDirection } from '@onekeyhq/engine/src/vaults/types';

import { ITxActionAmountProps } from '../types';

import { TxActionElementPressable } from './TxActionElementPressable';

export function TxActionElementAmount(props: ITxActionAmountProps) {
  const { direction, amount, symbol, onPress, ...others } = props;
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

  return (
    <TxActionElementPressable onPress={onPress}>
      <Text color={directionMeta.color} {...others}>
        {directionMeta.sign}
        {amount} {symbol}
      </Text>
    </TxActionElementPressable>
  );
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
