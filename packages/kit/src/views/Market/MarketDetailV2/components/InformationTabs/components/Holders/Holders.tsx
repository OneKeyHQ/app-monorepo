import { memo, useCallback } from 'react';

import { ListView, SizableText, Stack } from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useMarketHolders } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import HolderItem from './HolderItem';
import HoldersSkeleton from './HoldersSkeleton';

interface IHoldersProps {
  tokenAddress: string;
  networkId: string;
}

function Holders({ tokenAddress, networkId }: IHoldersProps) {
  const { holders, isRefreshing } = useMarketHolders({
    tokenAddress,
    networkId,
  });

  const renderItem: IListViewProps<IMarketTokenHolder>['renderItem'] =
    useCallback(
      ({ item, index }: { item: IMarketTokenHolder; index: number }) => {
        return (
          <HolderItem key={item.accountAddress} item={item} index={index} />
        );
      },
      [],
    );

  if (isRefreshing && holders.length === 0) {
    return <HoldersSkeleton />;
  }

  if (!isRefreshing && holders.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          No holders found
        </SizableText>
      </Stack>
    );
  }

  return (
    <ListView<IMarketTokenHolder>
      data={holders}
      renderItem={renderItem}
      keyExtractor={(item) => item.accountAddress}
      estimatedItemSize={70}
      showsVerticalScrollIndicator
      contentContainerStyle={{
        paddingBottom: '$4',
      }}
    />
  );
}

export default memo(Holders);
