import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Tabs,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { getMarketNativeCompactListStyle } from '../../layouts/mobileLayoutUtils';
import { TokenListItem } from '../MarketTokenList/components/TokenListItem';
import { TokenListSkeleton } from '../MarketTokenList/components/TokenListSkeleton';

import { useMarketTopCoins } from './hooks/useMarketTopCoins';
import { MarketTopCoinStar } from './MarketTopCoinStar';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';
import type { FlatListProps } from 'react-native';

type IMobileMarketTopCoinsFlatListProps = {
  listContainerProps: {
    paddingBottom: number;
  };
  shouldSuppressItemPress?: () => boolean;
};

const EMPTY_DATA: IMarketAssetListItem[] = [];

function toFiniteNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toMobileMarketToken(item: IMarketAssetListItem): IMarketToken {
  return {
    id: item.assetId,
    name: item.symbol.toUpperCase(),
    symbol: item.symbol.toUpperCase(),
    address: '',
    decimals: 0,
    price: toFiniteNumber(item.price),
    change24h: toFiniteNumber(item.priceChange24hPercent),
    priceChangeRaw: item.priceChange24hPercent,
    marketCap: toFiniteNumber(item.marketCap),
    liquidity: 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: toFiniteNumber(item.volume24h),
    tokenImageUri: item.logoUrl,
    networkLogoUri: '',
    networkId: '',
  };
}

function MobileMarketTopCoinsFlatListBase({
  listContainerProps,
  shouldSuppressItemPress,
}: IMobileMarketTopCoinsFlatListProps) {
  const intl = useIntl();
  const { data, handleItemPress, isLoading } = useMarketTopCoins();
  const tabBarHeight = useScrollContentTabBarOffset();
  const showSkeleton = isLoading && data.length === 0;

  const renderItem: FlatListProps<IMarketAssetListItem>['renderItem'] =
    useCallback(
      ({ item }) => (
        <TokenListItem
          item={toMobileMarketToken(item)}
          leading={<MarketTopCoinStar token={item} />}
          onPress={() => {
            if (shouldSuppressItemPress?.()) {
              return;
            }
            void handleItemPress(item);
          }}
        />
      ),
      [handleItemPress, shouldSuppressItemPress],
    );

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) {
      return <TokenListSkeleton count={10} />;
    }
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [intl, showSkeleton]);

  return (
    <Tabs.FlatList<IMarketAssetListItem>
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : data}
      renderItem={renderItem}
      keyExtractor={(item) => item.assetId}
      initialNumToRender={10}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        ...(platformEnv.isNative
          ? getMarketNativeCompactListStyle(true)
          : { paddingTop: 4 }),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketTopCoinsFlatList = memo(
  MobileMarketTopCoinsFlatListBase,
);
