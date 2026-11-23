import { YStack } from '@onekeyhq/components';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import type { IPoolAsset } from '@onekeyhq/shared/types/pools';

import type BigNumber from 'bignumber.js';

/**
 * A network's tokens as the app's own token rows. A pool form's token button
 * opens it in a popover: beside the button on wide screens, a sheet on phones.
 */
export function PoolTokenList({
  assets,
  balanceOf,
  onSelect,
  testIDPrefix,
}: {
  assets: IPoolAsset[];
  /** Adds each token's balance and its value */
  balanceOf?: (asset: IPoolAsset) => BigNumber;
  onSelect: (asset: IPoolAsset) => void;
  testIDPrefix: string;
}) {
  return (
    <YStack p="$1">
      {assets.map((asset) => {
        const balance = balanceOf?.(asset);
        return (
          <TokenListItem
            key={asset.id}
            testID={`${testIDPrefix}-${asset.symbol}`}
            tokenImageSrc={asset.logoURI}
            tokenSymbol={asset.symbol}
            tokenName={asset.name}
            tokenSize="md"
            balance={balance?.toFixed()}
            valueProps={
              balance
                ? {
                    value: balance.times(asset.priceUsd).toFixed(2),
                    currency: '$',
                  }
                : undefined
            }
            margin={0}
            onPress={() => onSelect(asset)}
          />
        );
      })}
    </YStack>
  );
}
