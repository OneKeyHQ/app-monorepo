import { type ReactNode, memo } from 'react';

import BigNumber from 'bignumber.js';

import {
  DashText,
  type INumberSizeableTextProps,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

import { isProtocolValueUnavailable } from './protocolValueUtils';

type IProtocolValueCellProps = {
  value: IDeFiAsset['value'];
  currencySymbol: string;
  priceUnavailableLabel: string;
  partialPriceUnavailableLabel?: string;
  showPriceUnavailableTooltip?: boolean;
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
    partialPriceUnavailableLabel,
    showPriceUnavailableTooltip,
    isUnavailable,
    justifyContent = 'flex-end',
    size = '$bodyMdMedium',
    color,
    textAlign,
    numberOfLines,
    fontVariant,
  }: IProtocolValueCellProps) => {
    const [{ hideValue }] = useSettingsValuePersistAtom();
    const valueBN = new BigNumber(value);
    const isValueUnavailable =
      isUnavailable ?? isProtocolValueUnavailable(value);
    let formattedValue = '';
    if (showPriceUnavailableTooltip && !isValueUnavailable) {
      formattedValue = hideValue
        ? '****'
        : numberFormat(valueBN.toFixed(), {
            formatter: 'value',
            formatterOptions: { currency: currencySymbol },
          });
    }

    let valueContent: ReactNode;
    if (isValueUnavailable) {
      valueContent = (
        <Tooltip
          renderTrigger={
            <SizableText
              size={size}
              color="$textSubdued"
              textAlign={textAlign}
              numberOfLines={numberOfLines}
              fontVariant={fontVariant}
              cursor="help"
            >
              --
            </SizableText>
          }
          renderContent={priceUnavailableLabel}
          placement="top"
        />
      );
    } else if (showPriceUnavailableTooltip) {
      valueContent = (
        <DashText
          tooltip={partialPriceUnavailableLabel ?? priceUnavailableLabel}
          size={size}
          color={color}
          textAlign={textAlign}
          numberOfLines={numberOfLines}
          fontVariant={fontVariant}
          dashThickness={0.5}
        >
          {formattedValue}
        </DashText>
      );
    } else {
      valueContent = (
        <NumberSizeableTextWrapper
          hideValue
          size={size}
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          color={color}
          textAlign={textAlign}
          numberOfLines={numberOfLines}
          fontVariant={fontVariant}
        >
          {valueBN.toFixed()}
        </NumberSizeableTextWrapper>
      );
    }

    return (
      <XStack alignItems="center" justifyContent={justifyContent} gap="$1">
        {valueContent}
      </XStack>
    );
  },
);

ProtocolValueCell.displayName = 'ProtocolValueCell';

export {
  isProtocolAssetValueUnavailable,
  isProtocolValueUnavailable,
} from './protocolValueUtils';
export { ProtocolValueCell };
