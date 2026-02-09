import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Tabs,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { TokenListSkeleton } from '../MarketTokenList/components/TokenListSkeleton';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';
import { MarketPerpsCategorySelector } from './MarketPerpsCategorySelector';
import { MarketPerpsTokenListItem } from './MarketPerpsTokenListItem';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';
import type { FlatListProps } from 'react-native';

interface IMobileMarketPerpsFlatListProps {
  listContainerProps: {
    paddingBottom: number;
  };
}

const EMPTY_DATA: IMarketPerpsToken[] = [];

function MobileMarketPerpsFlatListImpl({
  listContainerProps,
}: IMobileMarketPerpsFlatListProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const navigation = useAppNavigation();
  const intl = useIntl();

  const { tokens, categories, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const handleTokenPress = useCallback(
    (coin: string) => {
      setTimeout(async () => {
        navigation.switchTab(ETabRoutes.Perp);
        try {
          await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
            coin,
          });
        } catch (error) {
          console.error('Failed to change active asset:', error);
        }
      }, 80);
    },
    [navigation],
  );

  const allCategories = useMemo(
    () => [
      {
        tabId: 'all',
        name: intl.formatMessage({ id: ETranslations.global_all }),
        tokens: [],
      },
      ...categories,
    ],
    [categories, intl],
  );

  const renderItem: FlatListProps<IMarketPerpsToken>['renderItem'] =
    useCallback(
      ({ item }: { item: IMarketPerpsToken }) => (
        <MarketPerpsTokenListItem
          item={item}
          onPress={() => handleTokenPress(item.name)}
        />
      ),
      [handleTokenPress],
    );

  const keyExtractor = useCallback((item: IMarketPerpsToken) => item.name, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<IMarketPerpsToken> | null | undefined, index: number) => ({
      length: 73,
      offset: 73 * index,
      index,
    }),
    [],
  );

  const ListHeaderComponent = useMemo(
    () => (
      <YStack py="$1">
        <MarketPerpsCategorySelector
          categories={allCategories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
        />
      </YStack>
    ),
    [allCategories, selectedCategoryId],
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) {
      return <TokenListSkeleton count={10} />;
    }
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [isLoading, intl]);

  const tabBarHeight = useScrollContentTabBarOffset();

  return (
    <Tabs.FlatList<IMarketPerpsToken>
      showsVerticalScrollIndicator={false}
      data={isLoading ? EMPTY_DATA : tokens}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={15}
      maxToRenderPerBatch={20}
      windowSize={platformEnv.isNativeAndroid ? 7 : 3}
      removeClippedSubviews={platformEnv.isNativeIOS}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        paddingTop: 8 + (platformEnv.isNative ? 170 : 0),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketPerpsFlatList = memo(MobileMarketPerpsFlatListImpl);
