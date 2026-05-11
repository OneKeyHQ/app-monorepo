import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  type INumberSizeableTextProps,
  Icon,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import type { ILocalizedProtocolPositionSection } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

type IProtocolAssetValueProps = {
  value: IDeFiAsset['value'];
  currencySymbol: string;
  priceUnavailableLabel: string;
  size?: INumberSizeableTextProps['size'];
  color?: INumberSizeableTextProps['color'];
  textAlign?: INumberSizeableTextProps['textAlign'];
  numberOfLines?: INumberSizeableTextProps['numberOfLines'];
  fontVariant?: INumberSizeableTextProps['fontVariant'];
};

const ProtocolAssetValue = memo(
  ({
    value,
    currencySymbol,
    priceUnavailableLabel,
    size = '$bodyMdMedium',
    color,
    textAlign,
    numberOfLines,
    fontVariant,
  }: IProtocolAssetValueProps) => {
    const valueBN = new BigNumber(value);
    const isValueUnavailable = valueBN.isNaN() || valueBN.isZero();

    return (
      <XStack alignItems="center" justifyContent="flex-end" gap="$1">
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
ProtocolAssetValue.displayName = 'ProtocolAssetValue';

const ProtocolPositionSection = memo(
  ({
    itemKeyPrefix,
    section,
    currencySymbol,
    priceUnavailableLabel,
    tokenSize = 'sm',
  }: {
    itemKeyPrefix: string;
    section: ILocalizedProtocolPositionSection;
    currencySymbol: string;
    priceUnavailableLabel: string;
    tokenSize?: ITokenProps['size'];
  }) => {
    const intl = useIntl();
    const amountLabel = intl.formatMessage({
      id: ETranslations.content__amount,
    });
    return (
      <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2" gap="$2">
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText
            size="$headingXs"
            color="$text"
            textTransform="uppercase"
          >
            {section.title}
          </SizableText>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {amountLabel}
          </SizableText>
        </XStack>
        {section.assets.map((asset, assetIndex) => (
          <XStack
            key={`${itemKeyPrefix}-${section.key}-${asset.address}-${assetIndex}`}
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            py="$0"
            minHeight={44}
          >
            <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
              <Token
                size={tokenSize}
                tokenImageUri={asset.meta?.logoUrl}
                bg="$bgStrong"
              />
              <SizableText size="$bodyMdMedium" numberOfLines={1} flex={1}>
                {asset.symbol}
              </SizableText>
            </XStack>
            <YStack alignItems="flex-end" maxWidth="55%">
              <ProtocolAssetValue
                value={asset.value}
                currencySymbol={currencySymbol}
                priceUnavailableLabel={priceUnavailableLabel}
              />
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyMd"
                color="$textSubdued"
                formatter="balance"
                textAlign="right"
              >
                {asset.amount}
              </NumberSizeableTextWrapper>
            </YStack>
          </XStack>
        ))}
      </YStack>
    );
  },
);
ProtocolPositionSection.displayName = 'ProtocolPositionSection';

export { ProtocolAssetValue, ProtocolPositionSection };
export type { IProtocolAssetValueProps };
