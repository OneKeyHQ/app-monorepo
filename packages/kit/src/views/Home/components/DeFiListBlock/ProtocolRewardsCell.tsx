import { memo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ProtocolAssetValue } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionSection';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

// Renders a dedicated section column in the unified protocol table. The
// design (per spec) reads "7,239.6466 sUSDe ($8,898.99)" without a logo;
// when a position carries multiple assets they stack vertically.
// This cell only ever receives non-empty assets: empty assets are filtered
// upstream so the column shows a blank cell rather than a placeholder.

type IProtocolRewardsCellProps = {
  assets: IDeFiAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
};

const ProtocolRewardsCell = memo(
  ({
    assets,
    currencySymbol,
    priceUnavailableLabel,
  }: IProtocolRewardsCellProps) => {
    return (
      <YStack gap="$0.5" flex={1} minWidth={0}>
        {assets.map((asset, index) => (
          <XStack
            key={`${asset.address}-${index}`}
            alignItems="baseline"
            flexWrap="wrap"
          >
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyMd"
              formatter="balance"
              formatterOptions={{ tokenSymbol: asset.symbol }}
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
            <SizableText size="$bodyMd" color="$textSubdued">
              {' ('}
            </SizableText>
            <ProtocolAssetValue
              value={asset.value}
              size="$bodyMd"
              color="$textSubdued"
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
            />
            <SizableText size="$bodyMd" color="$textSubdued">
              )
            </SizableText>
          </XStack>
        ))}
      </YStack>
    );
  },
);

ProtocolRewardsCell.displayName = 'ProtocolRewardsCell';

export { ProtocolRewardsCell };
