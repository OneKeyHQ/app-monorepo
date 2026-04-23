import { memo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ILocalizedProtocolPositionSection } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

const ProtocolAssetValue = memo(
  ({
    value,
    currencySymbol,
    priceUnavailableLabel,
  }: {
    value: IDeFiAsset['value'];
    currencySymbol: string;
    priceUnavailableLabel: string;
  }) => {
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
          size="$bodyLg"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          color={isValueUnavailable ? '$text' : undefined}
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
  }: {
    itemKeyPrefix: string;
    section: ILocalizedProtocolPositionSection;
    currencySymbol: string;
    priceUnavailableLabel: string;
  }) => {
    return (
      <YStack bg="$bgSubdued" borderRadius="$2" px="$4" py="$3" gap="$2">
        <SizableText size="$headingXs" color="$text" textTransform="uppercase">
          {section.title}
        </SizableText>
        {section.assets.map((asset, assetIndex) => (
          <XStack
            key={`${itemKeyPrefix}-${section.key}-${asset.address}-${assetIndex}`}
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            py="$1"
          >
            <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
              <Token
                size="sm"
                tokenImageUri={asset.meta?.logoUrl}
                bg="$bgStrong"
              />
              <SizableText size="$headingSm" numberOfLines={1} flex={1}>
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

export { ProtocolPositionSection };
