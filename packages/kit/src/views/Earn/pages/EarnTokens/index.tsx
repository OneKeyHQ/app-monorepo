import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  SearchBar,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { AvailableAssetItem } from '../../components/AvailableAssetsFlatList';
import {
  EARN_LIST_ESTIMATED_ITEM_SIZE,
  EARN_LIST_ROW_GAP,
  EarnListRowSeparator,
} from '../../components/earnListRhythm';
import { earnListScrollBehaviorProps } from '../../components/earnListScrollProps';
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { useNavigateToEarnAsset } from '../../hooks/useNavigateToEarnAsset';
import { EarnTestIDs } from '../../testIDs';
import {
  mergeSimpleEarnWithStakingAssets,
  parseAprPercentValue,
} from '../../utils/availableAssetsUtils';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';

// tvl = sort by the summed TVL of all providers under each token (OK-58880,
// default option, no subtitle shown)
type IEarnTokensSortKey = 'tvl' | 'apy';

// Three Tokens-home categories (design: All / Stable Tokens / Non-Stable
// Tokens). Review P2: "non-stable" is NOT the server's NativeTokens contract
// (chain-native assets only — it would miss WBTC etc.), so the category is a
// local concept derived as All minus StableCoins.
type IEarnTokensCategory = 'all' | 'stable' | 'nonStable';

const TOKEN_CATEGORIES: {
  value: IEarnTokensCategory;
  labelId: ETranslations;
}[] = [
  { value: 'all', labelId: ETranslations.global_all },
  { value: 'stable', labelId: ETranslations.earn_stable_tokens__action },
  { value: 'nonStable', labelId: ETranslations.earn_non_stable_tokens__action },
];

// APY/APR merged into one sort dimension (OK-58880); use the display-facing
// aprWithoutFee, falling back to apr when absent. parseAprPercentValue
// handles range copy like "2.00% - 2.67% APR" (walkthrough r3 issue 3).
function getAssetAprSortValue(asset: IEarnAvailableAsset): number {
  return parseAprPercentValue(asset.aprWithoutFee || asset.apr);
}

// Stable identity so gating the first paint never re-creates the list data
const EMPTY_ASSETS: IEarnAvailableAsset[] = [];

function EarnTokensSkeleton() {
  return (
    // Mirrors the real row: same layout (symbol left, APY over TVL right), same
    // ListItem box metrics and the same row gap, so the skeleton-to-content
    // swap shifts neither row heights nor row rhythm (OK-59841, OK-59904)
    <YStack px="$pagePadding" gap={EARN_LIST_ROW_GAP}>
      {Array.from({ length: 8 }).map((_, index) => (
        <XStack key={index} minHeight="$11" py="$2" ai="center" gap="$3">
          <Skeleton w="$10" h="$10" borderRadius="$full" />
          <YStack flex={1}>
            <Skeleton h="$4" w="$24" />
          </YStack>
          <YStack ai="flex-end" gap="$1.5">
            <Skeleton h="$4" w="$20" />
            <Skeleton h="$3" w="$16" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function EarnTokensContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const navigateToAsset = useNavigateToEarnAsset();

  const [categoryType, setCategoryType] = useState<IEarnTokensCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  // Default sort = summed TVL across providers (OK-58880)
  const [sortKey, setSortKey] = useState<IEarnTokensSortKey>('tvl');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');

  // Fetch SimpleEarn + Staking + StableCoins once; every category derives from
  // these datasets client-side, so switching chips never re-requests the
  // server.
  // OK-59338: the base dataset is a server-side category (which already
  // excludes fixed-rate PT products) instead of All minus a fixed-rate symbol
  // set — that subtraction also removed simple-earn products of symbols that
  // happen to have a PT variant too (USDe), making them unsearchable here.
  // OK-59854: SimpleEarn alone is not the whole base though. Server categories
  // are disjoint, so native-staking assets (SOL/BTC/ETH/APT/POL/ATOM) only
  // appear under Staking; without them this page showed strictly fewer tokens
  // than the Earn home Trending section that links to it.
  const { result: assets, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.SimpleEarn,
      }),
    [],
    { watchLoading: true, undefinedResultIfError: true },
  );
  const { result: stakingAssets, isLoading: isStakingLoading } =
    usePromiseResult(
      () =>
        backgroundApiProxy.serviceStaking.getAvailableAssets({
          type: EAvailableAssetsTypeEnum.Staking,
        }),
      [],
      { watchLoading: true, undefinedResultIfError: true },
    );
  const { result: stableAssets, isLoading: isStableLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.StableCoins,
      }),
    [],
    { watchLoading: true, undefinedResultIfError: true },
  );
  const baseAssets = useMemo(
    () => mergeSimpleEarnWithStakingAssets(assets ?? [], stakingAssets ?? []),
    [assets, stakingAssets],
  );
  const stableSymbols = useMemo(
    () => new Set((stableAssets ?? []).map((asset) => asset.symbol)),
    [stableAssets],
  );
  // Category view over the merged dataset (review P2)
  const categoryAssets = useMemo(() => {
    if (categoryType === 'stable') {
      return baseAssets.filter((asset) => stableSymbols.has(asset.symbol));
    }
    if (categoryType === 'nonStable') {
      return baseAssets.filter((asset) => !stableSymbols.has(asset.symbol));
    }
    return baseAssets;
  }, [baseAssets, categoryType, stableSymbols]);

  // Data source for the default sort (OK-58880): total TVL of all providers
  // under each symbol. Reuses the all-protocol aggregation (single request +
  // 5-minute cache)
  const { providers: aggregatedProviders, isLoading: isAggregationLoading } =
    useEarnAllProtocols();
  const symbolTvlMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const aggregated of aggregatedProviders) {
      for (const row of aggregated.tokens) {
        const key = row.symbol.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + row.tvlValue);
      }
    }
    return map;
  }, [aggregatedProviders]);

  // Derive from the category view so the network control only offers
  // networks that exist in the current category (review P2)
  const { availableNetworkIds, networkAssetCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of categoryAssets) {
      const networkIds = new Set(
        (asset.protocols ?? []).map((protocol) => protocol.networkId),
      );
      for (const networkId of networkIds) {
        counts[networkId] = (counts[networkId] ?? 0) + 1;
      }
    }
    return {
      availableNetworkIds: Object.keys(counts),
      networkAssetCounts: counts,
    };
  }, [categoryAssets]);

  // Review P2: when the category switches, a previously selected network may
  // not exist in the new dataset - intersect the selection with the new
  // available set so a stale filter cannot silently empty the list
  useEffect(() => {
    setSelectedNetworkIds((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const available = new Set(availableNetworkIds);
      const next = prev.filter((networkId) => available.has(networkId));
      return next.length === prev.length ? prev : next;
    });
  }, [availableNetworkIds]);

  const filteredAssets = useMemo(() => {
    const list = categoryAssets;
    const selectedSet = new Set(selectedNetworkIds);
    const keyword = searchText.trim().toLowerCase();
    return list.filter((asset) => {
      if (
        selectedSet.size > 0 &&
        !(asset.protocols ?? []).some((protocol) =>
          selectedSet.has(protocol.networkId),
        )
      ) {
        return false;
      }
      if (
        keyword &&
        !asset.symbol.toLowerCase().includes(keyword) &&
        !asset.name?.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      return true;
    });
  }, [categoryAssets, searchText, selectedNetworkIds]);

  const sortedAssets = useMemo(
    () =>
      filteredAssets.toSorted((assetA, assetB) => {
        const valueA =
          sortKey === 'tvl'
            ? (symbolTvlMap.get(assetA.symbol.toLowerCase()) ?? 0)
            : getAssetAprSortValue(assetA);
        const valueB =
          sortKey === 'tvl'
            ? (symbolTvlMap.get(assetB.symbol.toLowerCase()) ?? 0)
            : getAssetAprSortValue(assetB);
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }),
    [filteredAssets, sortDirection, sortKey, symbolTvlMap],
  );

  // Sort options (OK-58880): APY/APR both directions + TVL both directions,
  // defaulting to TVL High to Low
  const sortOptions = useMemo<IEarnSortOption[]>(() => {
    const tvlLabel = intl.formatMessage({ id: ETranslations.earn_tvl });
    const yieldLabel = intl.formatMessage({ id: ETranslations.defi_apr_apy });
    const highToLow = intl.formatMessage({
      id: ETranslations.high_to_low__action,
    });
    const lowToHigh = intl.formatMessage({
      id: ETranslations.low_to_high__action,
    });
    return [
      {
        label: `${yieldLabel} ${highToLow}`,
        triggerLabel: yieldLabel,
        value: 'apy',
        direction: 'desc',
      },
      {
        label: `${yieldLabel} ${lowToHigh}`,
        triggerLabel: yieldLabel,
        value: 'apy',
        direction: 'asc',
      },
      {
        label: `${tvlLabel} ${highToLow}`,
        triggerLabel: tvlLabel,
        value: 'tvl',
        direction: 'desc',
      },
      {
        label: `${tvlLabel} ${lowToHigh}`,
        triggerLabel: tvlLabel,
        value: 'tvl',
        direction: 'asc',
      },
    ];
  }, [intl]);

  const handleSortChange = useCallback(
    (key: string, direction: IEarnSortDirection) => {
      setSortKey(key as IEarnTokensSortKey);
      setSortDirection(direction);
    },
    [],
  );

  const totalLiquidityLabel = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.dexmarket_details_liquidity_change_total,
      }),
    [intl],
  );

  const handleAssetPress = useCallback(
    (asset: IEarnAvailableAsset) => {
      void navigateToAsset(asset);
    },
    [navigateToAsset],
  );

  const tvlLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.earn_tvl }),
    [intl],
  );

  const renderItem = useCallback(
    ({ item }: { item: IEarnAvailableAsset }) => (
      <AvailableAssetItem
        asset={item}
        categoryType={EAvailableAssetsTypeEnum.SimpleEarn}
        totalLiquidityLabel={totalLiquidityLabel}
        // Walkthrough r3: show the summed provider TVL under APY so the
        // default TVL-desc sort is visible on the row
        tvlValue={symbolTvlMap.get(item.symbol.toLowerCase())}
        tvlLabel={tvlLabel}
        testID={EarnTestIDs.tokensPageItem(item.symbol)}
        onPress={() => handleAssetPress(item)}
      />
    ),
    [handleAssetPress, totalLiquidityLabel, symbolTvlMap, tvlLabel],
  );

  const keyExtractor = useCallback(
    (item: IEarnAvailableAsset) => item.symbol,
    [],
  );

  // OK-59841: available-assets resolves well before the protocol aggregation,
  // but the aggregation owns both the TVL sub-line on every row and the values
  // the default TVL sort reads. Painting as soon as available-assets lands
  // therefore draws one-line rows in a provisional (all-zero) order, then
  // grows every row by a line and reorders the whole list — which reads as a
  // jitter under the page title. Keep the skeleton until every field the rows
  // render and sort by is settled, so the list is painted exactly once.
  const isInitialLoading =
    isLoading ||
    isStakingLoading ||
    isAggregationLoading ||
    (categoryType !== 'all' && isStableLoading);

  // Passed as an element (stable component type), so re-renders reconcile
  // in place and the SearchBar keeps focus while typing
  const listHeader = (
    <>
      <YStack px="$pagePadding" pb="$2">
        <SearchBar
          testID={EarnTestIDs.tokensSearchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={intl.formatMessage({
            id: ETranslations.global_search,
          })}
        />
      </YStack>
      <XStack px="$pagePadding" py="$2" ai="center" jc="space-between">
        <NetworkFilterControl
          testID={EarnTestIDs.tokensNetworkFilter}
          variant="compact"
          availableNetworkIds={availableNetworkIds}
          selectedNetworkIds={selectedNetworkIds}
          networkAssetCounts={networkAssetCounts}
          onSelectionChange={setSelectedNetworkIds}
        />
        <EarnMobileSortControl
          sortKey={sortKey}
          sortDirection={sortDirection}
          options={sortOptions}
          onSortChange={handleSortChange}
          compact
          testID={EarnTestIDs.tokensSortControl}
        />
      </XStack>
      <XStack px="$pagePadding" py="$2" gap="$2">
        {TOKEN_CATEGORIES.map(({ value: type, labelId }) => {
          const isActive = categoryType === type;
          return (
            <XStack
              key={type}
              testID={EarnTestIDs.tokensCategoryChip(type)}
              role="button"
              px="$3"
              py="$1"
              borderRadius="$full"
              bg={isActive ? '$bgStrong' : '$bgSubdued'}
              cursor="pointer"
              userSelect="none"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => setCategoryType(type)}
            >
              <SizableText
                size="$bodyMdMedium"
                color={isActive ? '$text' : '$textSubdued'}
              >
                {intl.formatMessage({ id: labelId })}
              </SizableText>
            </XStack>
          );
        })}
      </XStack>
    </>
  );

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_tokens__title })}
        </SizableText>
      }
      showBackButton
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      bodyListMode
    >
      {/* Virtualized full list (review feedback): the ListView owns the
          scrolling; filter/sort/search controls scroll with the content as
          the list header, same as the previous ScrollView layout */}
      <ListView
        flex={1}
        {...earnListScrollBehaviorProps}
        data={isInitialLoading ? EMPTY_ASSETS : sortedAssets}
        estimatedItemSize={EARN_LIST_ESTIMATED_ITEM_SIZE}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={EarnListRowSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isInitialLoading ? <EarnTokensSkeleton /> : null}
        contentContainerStyle={{ pb: tabBarHeight }}
      />
    </EarnPageContainer>
  );
}

export default function EarnTokens() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnTokensContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
