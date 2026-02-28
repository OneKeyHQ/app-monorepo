import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Tabs,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketBasicConfig } from '../../../hooks/useMarketBasicConfig';
import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
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
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { navigateToPerps } = usePerpsNavigation();
  const intl = useIntl();

  const { perpsCategories } = useMarketBasicConfig();

  // Auto-select first category when categories load
  useEffect(() => {
    if (!selectedCategoryId && perpsCategories.length > 0) {
      setSelectedCategoryId(perpsCategories[0].categoryId);
    }
  }, [perpsCategories, selectedCategoryId]);

  const { tokens, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const handleTokenPress = navigateToPerps;

  const categoryTabs = useMemo(
    () =>
      perpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [perpsCategories],
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
      <MarketPerpsCategorySelector
        categories={categoryTabs}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        containerStyle={{
          px: '$5',
          pt: '$3',
          pb: '$2',
        }}
      />
    ),
    [categoryTabs, selectedCategoryId],
  );

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

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
  }, [showSkeleton, intl]);

  const tabBarHeight = useScrollContentTabBarOffset();

  return (
    <Tabs.FlatList<IMarketPerpsToken>
      showsVerticalScrollIndicator={false}
      data={showSkeleton ? EMPTY_DATA : tokens}
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
