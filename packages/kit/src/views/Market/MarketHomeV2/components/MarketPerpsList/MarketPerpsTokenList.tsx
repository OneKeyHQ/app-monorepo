import { memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  Table,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketBasicConfig } from '../../../hooks/useMarketBasicConfig';
import { usePerpsNavigation } from '../../../hooks/usePerpsNavigation';

import { useMarketPerpsTokenList } from './hooks/useMarketPerpsTokenList';
import { usePerpsColumns } from './hooks/usePerpsColumns';
import { MarketPerpsCategorySelector } from './MarketPerpsCategorySelector';

import type { IMarketPerpsToken } from './hooks/useMarketPerpsTokenList';

type IMarketPerpsTokenListProps = {
  tabIntegrated?: boolean;
  listContainerProps?: {
    paddingBottom: number;
  };
};

function MarketPerpsTokenListImpl({
  tabIntegrated,
  listContainerProps,
}: IMarketPerpsTokenListProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { navigateToPerps } = usePerpsNavigation();
  const intl = useIntl();
  const { md } = useMedia();

  const { perpsCategories } = useMarketBasicConfig();

  // Auto-select first category when categories load
  useEffect(() => {
    if (!selectedCategoryId && perpsCategories.length > 0) {
      setSelectedCategoryId(perpsCategories[0].categoryId);
    }
  }, [perpsCategories, selectedCategoryId]);

  const { tokens, isLoading, hasRealTimeData } = useMarketPerpsTokenList({
    selectedCategoryId,
  });

  const perpsColumns = usePerpsColumns();

  const handleTokenPress = navigateToPerps;

  const categoryTabs = useMemo(
    () =>
      perpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [perpsCategories],
  );

  const CategorySelector = useMemo(
    () => (
      <MarketPerpsCategorySelector
        categories={categoryTabs}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        containerStyle={{
          px: '$4',
          pt: '$3',
          pb: '$2',
        }}
      />
    ),
    [categoryTabs, selectedCategoryId],
  );

  const showSkeleton = Boolean(isLoading) && tokens.length === 0;

  const tabBarHeight = useScrollContentTabBarOffset();

  const TableEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </Stack>
    );
  }, [isLoading, intl]);

  return (
    <Stack flex={1} width="100%">
      {CategorySelector}
      <Stack
        flex={1}
        className="normal-scrollbar"
        style={{
          paddingTop: 4,
          overflowX: 'auto',
          ...(md ? { marginLeft: 8, marginRight: 8 } : {}),
        }}
      >
        <Stack flex={1} minHeight={platformEnv.isNative ? undefined : 400}>
          {showSkeleton ? (
            <Table.Skeleton
              columns={perpsColumns}
              count={20}
              rowProps={{ minHeight: '$14' }}
            />
          ) : (
            <Table<IMarketPerpsToken>
              contentContainerStyle={
                tabIntegrated
                  ? {
                      paddingTop: 8 + (platformEnv.isNative ? 150 : 0),
                      paddingBottom: platformEnv.isNativeAndroid
                        ? (listContainerProps?.paddingBottom ?? 104)
                        : tabBarHeight,
                    }
                  : {
                      paddingBottom: platformEnv.isNativeAndroid
                        ? 104
                        : tabBarHeight,
                    }
              }
              stickyHeader
              scrollEnabled={!tabIntegrated || platformEnv.isNative}
              columns={perpsColumns}
              dataSource={tokens}
              keyExtractor={(item) => item.name}
              estimatedItemSize="$14"
              extraData={hasRealTimeData}
              TableEmptyComponent={TableEmptyComponent}
              onRow={(item) => ({
                onPress: () => handleTokenPress(item.name),
              })}
            />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

export const MarketPerpsTokenList = memo(MarketPerpsTokenListImpl);
export type { IMarketPerpsTokenListProps };
