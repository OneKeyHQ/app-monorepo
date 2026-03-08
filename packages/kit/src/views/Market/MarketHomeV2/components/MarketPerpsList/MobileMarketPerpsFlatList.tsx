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

import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';
import { TokenListSkeleton } from '../MarketTokenList/components/TokenListSkeleton';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';
import { MarketPerpsTokenListItem } from './MarketPerpsTokenListItem';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';
import type { FlatListProps } from 'react-native';

interface IMobileMarketPerpsFlatListProps {
  selectedCategoryId: string;
  listContainerProps: {
    paddingBottom: number;
  };
}

const EMPTY_DATA: IMarketPerpsToken[] = [];

function MobileMarketPerpsFlatListImpl({
  selectedCategoryId,
  listContainerProps,
}: IMobileMarketPerpsFlatListProps) {
  const { navigateToPerps } = usePerpsNavigation();
  const intl = useIntl();

  const { tokens, isLoading } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const handleTokenPress = navigateToPerps;

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
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={{
        paddingTop: 8 + (platformEnv.isNative ? 248 : 0),
        paddingBottom: platformEnv.isNativeAndroid
          ? listContainerProps.paddingBottom
          : tabBarHeight,
      }}
    />
  );
}

export const MobileMarketPerpsFlatList = memo(MobileMarketPerpsFlatListImpl);
