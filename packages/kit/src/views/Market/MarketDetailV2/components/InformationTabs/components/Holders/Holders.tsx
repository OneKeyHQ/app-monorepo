import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Tabs, useMedia } from '@onekeyhq/components';
import { useLeftColumnWidthAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { useMarketHolders } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

import { HoldersSkeleton } from './components/HoldersSkeleton';
import { HolderItemNormal } from './layout/HolderItemNormal/HolderItemNormal';
import { HoldersHeaderNormal } from './layout/HolderItemNormal/HoldersHeaderNormal';
import { HolderItemSmall } from './layout/HolderItemSmall/HolderItemSmall';
import { HoldersHeaderSmall } from './layout/HolderItemSmall/HoldersHeaderSmall';

import type { FlatListProps } from 'react-native';

interface IHoldersProps {
  tokenAddress: string;
  networkId: string;
}

function HoldersBase({ tokenAddress, networkId }: IHoldersProps) {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const [leftColumnWidth] = useLeftColumnWidthAtom();
  const { holders, isRefreshing } = useMarketHolders({
    tokenAddress,
    networkId,
  });

  const shouldEnableScroll = leftColumnWidth < 930;

  const renderItem: FlatListProps<IMarketTokenHolder>['renderItem'] =
    useCallback(
      ({ item, index }: { item: IMarketTokenHolder; index: number }) => {
        return gtLg ? (
          <HolderItemNormal item={item} index={index} networkId={networkId} />
        ) : (
          <HolderItemSmall item={item} index={index} networkId={networkId} />
        );
      },
      [networkId, gtLg],
    );

  return (
    <Tabs.FlatList<IMarketTokenHolder>
      data={holders}
      renderItem={renderItem}
      keyExtractor={(item: IMarketTokenHolder) =>
        item.accountAddress + item.fiatValue + item.amount
      }
      showsVerticalScrollIndicator
      ListEmptyComponent={
        isRefreshing ? (
          <HoldersSkeleton />
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.dexmarket_details_nodata,
              })}
            </SizableText>
          </Stack>
        )
      }
    />
  );
}

const Holders = memo(HoldersBase);

export { Holders };
