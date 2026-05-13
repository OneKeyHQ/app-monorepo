import { memo } from 'react';

import BigNumber from 'bignumber.js';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import { Icon, Stack, Tooltip, XStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

export function isProtocolValueUnavailable(
  value: IDeFiAsset['value'],
): boolean {
  const valueBN = new BigNumber(value);
  return valueBN.isNaN() || valueBN.isZero();
}

type IProtocolValueCellProps = {
  value: IDeFiAsset['value'];
  currencySymbol: string;
  priceUnavailableLabel: string;
  isUnavailable?: boolean;
  justifyContent?: 'flex-start' | 'flex-end';
  size?: INumberSizeableTextProps['size'];
  color?: INumberSizeableTextProps['color'];
  textAlign?: INumberSizeableTextProps['textAlign'];
  numberOfLines?: INumberSizeableTextProps['numberOfLines'];
  fontVariant?: INumberSizeableTextProps['fontVariant'];
};

const ProtocolValueCell = memo(
  ({
    value,
    currencySymbol,
    priceUnavailableLabel,
    isUnavailable,
    justifyContent = 'flex-end',
    size = '$bodyMdMedium',
    color,
    textAlign,
    numberOfLines,
    fontVariant,
  }: IProtocolValueCellProps) => {
    const valueBN = new BigNumber(value);
    const isValueUnavailable =
      isUnavailable ?? isProtocolValueUnavailable(value);

    return (
      <XStack alignItems="center" justifyContent={justifyContent} gap="$1">
        {isValueUnavailable ? (
          <Stack width="$4" height="$4">
            <Tooltip
              renderContent={priceUnavailableLabel}
              renderTrigger={
                <Icon name="ErrorOutline" size="$4" color="$iconCritical" />
              }
            />
          </Stack>
        ) : null}
        <NumberSizeableTextWrapper
          hideValue
          size={size}
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          color={isValueUnavailable ? '$text' : color}
          textAlign={textAlign}
          numberOfLines={numberOfLines}
          fontVariant={fontVariant}
        >
          {isValueUnavailable ? '--' : valueBN.toFixed()}
        </NumberSizeableTextWrapper>
      </XStack>
    );
  },
);

ProtocolValueCell.displayName = 'ProtocolValueCell';

export { ProtocolValueCell };
