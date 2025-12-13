import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  ListView,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsAllAssetCtxsAtom,
  usePerpsAllAssetsFilteredAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpTokenSortConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPerpTokenSortConfig,
  IPerpTokenSortField,
  IPerpsAssetCtx,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import { XYZ_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { usePerpTokenSelector } from '../../hooks';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpTokenSelectorRow } from './PerpTokenSelectorRow';

const TAB_LABELS = {
  all: 'PERPS',
  hip3: 'HIP3',
} as const;

function TabItem({
  name,
  isFocused,
  onPress,
}: {
  name: string;
  isFocused: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      pb="$3"
      ml="$5"
      mr="$2"
      borderBottomWidth={isFocused ? '$0.5' : '$0'}
      borderBottomColor="$borderActive"
      onPress={onPress}
      cursor="pointer"
    >
      <SizableText
        size="$headingXs"
        color={isFocused ? '$text' : '$textSubdued'}
      >
        {name}
      </SizableText>
    </XStack>
  );
}

function MobileTokenSelectorModal({
  onLoadingChange,
}: {
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useHyperliquidActions();
  const { searchQuery, setSearchQuery } = usePerpTokenSelector();

  const handleSelectToken = async (symbol: string) => {
    try {
      onLoadingChange(true);
      navigation.popStack();
      await actions.current.changeActiveAsset({ coin: symbol });
    } catch (error) {
      console.error('Failed to switch token:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  const [{ assetsByDex }] = usePerpsAllAssetsFilteredAtom();
  const [{ assetCtxsByDex }] = usePerpsAllAssetCtxsAtom();
  const [sortConfig, setSortConfig] = usePerpTokenSortConfigPersistAtom();
  const [activeTab, setActiveTab] = useState<'all' | 'hip3'>('all');

  const computeSortValues = useCallback(
    (assetCtx: IPerpsAssetCtx | undefined) => {
      const markPrice = Number(assetCtx?.markPx || 0);
      const fundingRate = Number(assetCtx?.funding || 0);
      const volume24h = Number(assetCtx?.dayNtlVlm || 0);
      const openInterest = Number(assetCtx?.openInterest || 0);
      const prevDayPx = Number(assetCtx?.prevDayPx || 0);
      const change24hPercent =
        prevDayPx > 0 ? ((markPrice - prevDayPx) / prevDayPx) * 100 : 0;
      const openInterestValue = openInterest * markPrice;
      return {
        markPrice,
        fundingRate,
        volume24h,
        openInterest,
        openInterestValue,
        change24hPercent,
      };
    },
    [],
  );

  const sortCompare = useCallback(
    (
      a: {
        asset: IPerpsUniverse;
        sortValues: ReturnType<typeof computeSortValues>;
      },
      b: {
        asset: IPerpsUniverse;
        sortValues: ReturnType<typeof computeSortValues>;
      },
    ) => {
      const sortField = sortConfig?.field ?? '';
      const sortDirection = sortConfig?.direction ?? 'desc';
      if (!sortField) {
        return 0;
      }
      let compareResult = 0;
      switch (sortField) {
        case 'name':
          compareResult = a.asset.name.localeCompare(b.asset.name, undefined, {
            sensitivity: 'base',
          });
          break;
        case 'markPrice':
          compareResult = a.sortValues.markPrice - b.sortValues.markPrice;
          break;
        case 'change24hPercent':
          compareResult =
            a.sortValues.change24hPercent - b.sortValues.change24hPercent;
          break;
        case 'fundingRate':
          compareResult = a.sortValues.fundingRate - b.sortValues.fundingRate;
          break;
        case 'volume24h':
          compareResult = a.sortValues.volume24h - b.sortValues.volume24h;
          break;
        case 'openInterest':
          compareResult =
            a.sortValues.openInterestValue - b.sortValues.openInterestValue;
          break;
        default:
          break;
      }
      return sortDirection === 'asc' ? compareResult : -compareResult;
    },
    [sortConfig?.direction, sortConfig?.field],
  );

  const mockedListData = useMemo(() => {
    const assetsByDexTyped: IPerpsUniverse[][] = assetsByDex || [];
    const assetCtxsByDexTyped: IPerpsAssetCtx[][] = assetCtxsByDex || [];

    const combinedEntries = assetsByDexTyped.flatMap(
      (assets: IPerpsUniverse[], dexIndex: number) => {
        if (activeTab === 'hip3' && dexIndex !== 1) return [];
        const ctxs = assetCtxsByDexTyped[dexIndex] || [];
        return assets.map((asset, index) => {
          const normalizedAssetId =
            dexIndex === 1
              ? asset.assetId - XYZ_ASSET_ID_OFFSET
              : asset.assetId;
          const sortValues = computeSortValues(ctxs?.[normalizedAssetId]);
          return {
            dexIndex,
            index,
            assetId: asset.assetId,
            asset,
            sortValues,
          };
        });
      },
    );

    const sortField = sortConfig?.field ?? '';
    if (!sortField) {
      return combinedEntries.map((entry) => ({
        dexIndex: entry.dexIndex,
        index: entry.index,
        assetId: entry.assetId,
      }));
    }
    const sorted = [...combinedEntries].sort((a, b) =>
      sortCompare(
        { asset: a.asset, sortValues: a.sortValues },
        { asset: b.asset, sortValues: b.sortValues },
      ),
    );
    return sorted.map((entry) => ({
      dexIndex: entry.dexIndex,
      index: entry.index,
      assetId: entry.assetId,
    }));
  }, [
    activeTab,
    assetCtxsByDex,
    assetsByDex,
    computeSortValues,
    sortCompare,
    sortConfig?.field,
  ]);

  const keyExtractor = useCallback(
    (item: { dexIndex: number; assetId?: number; index: number }) => {
      const assetId = item.assetId ?? item.index;
      return `${item.dexIndex}-${assetId}`;
    },
    [],
  );

  const handleSortPress = useCallback(
    (field: IPerpTokenSortField) => {
      setSortConfig((prev: IPerpTokenSortConfig | null) => {
        if (prev?.field === field) {
          if (prev.direction === 'asc') {
            return null;
          }
          return { field, direction: 'asc' };
        }
        return { field, direction: 'desc' };
      });
    },
    [setSortConfig],
  );
  let iconName: string;
  if (sortConfig?.field === 'volume24h' && sortConfig?.direction === 'asc') {
    iconName = 'ChevronTopOutline';
  } else if (sortConfig?.field === 'volume24h') {
    iconName = 'ChevronBottomOutline';
  } else {
    iconName = 'ChevronGrabberVerOutline';
  }
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.global_search_asset,
          }),
          onChangeText: ({ nativeEvent }) => {
            const afterTrim = nativeEvent.text.trim();
            setSearchQuery(afterTrim);
          },
          searchBarInputValue: undefined, // keep value undefined to make SearchBar Input debounce works
        }}
      />
      <XStack
        mb="$2"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <XStack flex={1}>
          {(['all', 'hip3'] as const).map((tabKey) => (
            <TabItem
              key={tabKey}
              name={TAB_LABELS[tabKey]}
              isFocused={activeTab === tabKey}
              onPress={() => setActiveTab(tabKey)}
            />
          ))}
        </XStack>
      </XStack>
      <XStack
        px="$5"
        pb="$3"
        pt="$1"
        justifyContent="space-between"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('volume24h')}
          cursor="pointer"
          userSelect="none"
        >
          <SizableText
            size="$bodySm"
            color={sortConfig?.field === 'volume24h' ? '$text' : '$textSubdued'}
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_asset,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_volume,
            })}
          </SizableText>
          <Icon name={iconName as any} size="$3" color="$icon" />
        </XStack>
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => handleSortPress('change24hPercent')}
          cursor="pointer"
          userSelect="none"
        >
          <SizableText
            size="$bodySm"
            color={
              sortConfig?.field === 'change24hPercent'
                ? '$text'
                : '$textSubdued'
            }
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_last_price,
            })}{' '}
            /{' '}
            {intl.formatMessage({
              id: ETranslations.perp_token_selector_24h_change,
            })}
          </SizableText>
          {sortConfig?.field === 'change24hPercent' ? (
            <Icon
              name={
                sortConfig.direction === 'asc'
                  ? 'ChevronTopOutline'
                  : 'ChevronBottomOutline'
              }
              size="$3"
              color="$icon"
            />
          ) : null}
        </XStack>
      </XStack>
      <Page.Body>
        <YStack flex={1} mt="$2">
          <ListView
            useFlashList
            keyExtractor={keyExtractor}
            estimatedItemSize={44}
            windowSize={4}
            initialNumToRender={10}
            removeClippedSubviews
            decelerationRate="normal"
            showsVerticalScrollIndicator
            contentContainerStyle={{
              paddingBottom: 10,
            }}
            data={mockedListData} // eslint-disable-line spellcheck/spell-checker
            renderItem={({ item: mockedToken }) => (
              <PerpTokenSelectorRow
                isOnModal
                mockedToken={mockedToken}
                onPress={(name) => handleSelectToken(name)}
              />
            )}
            ListEmptyComponent={
              <XStack p="$5" justifyContent="center">
                <SizableText size="$bodySm" color="$textSubdued">
                  {searchQuery
                    ? intl.formatMessage({
                        id: ETranslations.perp_token_selector_empty,
                      })
                    : intl.formatMessage({
                        id: ETranslations.perp_token_selector_loading,
                      })}
                </SizableText>
              </XStack>
            }
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

function MobileTokenSelectorWithProvider() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <MobileTokenSelectorModal onLoadingChange={() => {}} />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

export default memo(MobileTokenSelectorWithProvider);
