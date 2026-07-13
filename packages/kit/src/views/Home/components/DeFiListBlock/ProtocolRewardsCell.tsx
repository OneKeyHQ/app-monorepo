import { memo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

// Renders the dedicated Rewards column in the unified protocol table. The
// design (per spec) reads "7,239.6466 sUSDe ($8,898.99)" without a logo;
// when a position carries multiple reward assets they stack vertically.
// This cell only ever receives non-empty rewards: empty rewards are filtered
// upstream so the column shows a blank cell rather than a placeholder.

type IProtocolRewardsCellProps = {
  rewards: IDeFiAsset[];
  currencySymbol: string;
  priceUnavailableLabel: string;
};

const ProtocolRewardsCell = memo(
  ({
    rewards,
    currencySymbol,
    priceUnavailableLabel,
  }: IProtocolRewardsCellProps) => {
    return (
      <YStack gap="$0.5" flex={1} minWidth={0}>
        {rewards.map((asset, index) => (
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
            <ProtocolValueCell
              value={asset.value}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={isProtocolAssetValueUnavailable(asset)}
              size="$bodyMd"
              color="$textSubdued"
              justifyContent="flex-start"
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
