import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ListView, SizableText, Stack } from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useMarketHolders } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { HolderItem } from './HolderItem';
import { HoldersHeader } from './HoldersHeader';
import { HoldersSkeleton } from './HoldersSkeleton';

interface IHoldersProps {
  tokenAddress: string;
  networkId: string;
}

function HoldersBase({ tokenAddress, networkId }: IHoldersProps) {
  const intl = useIntl();
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
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_nodata,
          })}
        </SizableText>
      </Stack>
    );
  }

  return (
    <>
      <HoldersHeader />
      <ListView<IMarketTokenHolder>
        data={holders}
        renderItem={renderItem}
        keyExtractor={(item) => item.accountAddress + item.fiatValue}
        estimatedItemSize={70}
        showsVerticalScrollIndicator
        contentContainerStyle={{
          paddingBottom: '$4',
        }}
      />
    </>
  );
}

const Holders = memo(HoldersBase);

export { Holders };
