import { useCallback, useMemo, useState } from 'react';

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
import { earnListScrollBehaviorProps } from '../../components/earnListScrollProps';
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { useNavigateToEarnAsset } from '../../hooks/useNavigateToEarnAsset';
import { EarnTestIDs } from '../../testIDs';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';

// tvl = sort by the summed TVL of all providers under each token (OK-58880,
// default option, no subtitle shown)
type IEarnTokensSortKey = 'tvl' | 'apy';

// Three Tokens-home categories (design: All / Stable Tokens / Non-Stable Tokens)
const TOKEN_CATEGORY_TYPES = [
  EAvailableAssetsTypeEnum.All,
  EAvailableAssetsTypeEnum.StableCoins,
  EAvailableAssetsTypeEnum.NativeTokens,
] as const;

const TOKEN_CATEGORY_LABEL_IDS: Record<string, ETranslations> = {
  [EAvailableAssetsTypeEnum.All]: ETranslations.global_all,
  [EAvailableAssetsTypeEnum.StableCoins]:
    ETranslations.earn_stable_tokens__action,
  [EAvailableAssetsTypeEnum.NativeTokens]:
    ETranslations.earn_non_stable_tokens__action,
};

function parseRate(value?: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// APY/APR merged into one sort dimension (OK-58880); use the display-facing
// aprWithoutFee, falling back to apr when absent
function getAssetAprSortValue(asset: IEarnAvailableAsset): number {
  return parseRate(asset.aprWithoutFee || asset.apr);
}

function EarnTokensSkeleton() {
  return (
    <YStack px="$pagePadding" gap="$4" pt="$4">
      {Array.from({ length: 8 }).map((_, index) => (
        <XStack key={index} ai="center" gap="$3">
          <Skeleton w="$10" h="$10" borderRadius="$full" />
          <YStack gap="$1.5" flex={1}>
            <Skeleton h="$4" w="$24" />
            <Skeleton h="$3" w="$16" />
          </YStack>
          <Skeleton h="$4" w="$20" />
        </XStack>
      ))}
    </YStack>
  );
}

function EarnTokensContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const navigateToAsset = useNavigateToEarnAsset();

  const [categoryType, setCategoryType] = useState<EAvailableAssetsTypeEnum>(
    EAvailableAssetsTypeEnum.All,
  );
  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  // Default sort = summed TVL across providers (OK-58880)
  const [sortKey, setSortKey] = useState<IEarnTokensSortKey>('tvl');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');

  const { result: assets, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: categoryType,
      }),
    [categoryType],
    { watchLoading: true, undefinedResultIfError: true },
  );

  // The Tokens list excludes fixed-rate assets (OK-58879): fixed-rate (PT-like,
  // separate symbols) has its own list page, so filter by the fixedRate symbol set
  const { result: fixedRateAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.FixedRate,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const fixedRateSymbols = useMemo(
    () => new Set((fixedRateAssets ?? []).map((asset) => asset.symbol)),
    [fixedRateAssets],
  );

  // Data source for the default sort (OK-58880): total TVL of all providers
  // under each symbol. Reuses the all-protocol aggregation (single request +
  // 5-minute cache); not shown on rows, used for sorting only
  const { providers: aggregatedProviders } = useEarnAllProtocols();
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

  const { availableNetworkIds, networkAssetCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of assets ?? []) {
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
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const list = assets ?? [];
    const selectedSet = new Set(selectedNetworkIds);
    const keyword = searchText.trim().toLowerCase();
    return list.filter((asset) => {
      if (fixedRateSymbols.has(asset.symbol)) {
        return false;
      }
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
  }, [assets, fixedRateSymbols, searchText, selectedNetworkIds]);

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

  const renderItem = useCallback(
    ({ item }: { item: IEarnAvailableAsset }) => (
      <AvailableAssetItem
        asset={item}
        categoryType={EAvailableAssetsTypeEnum.SimpleEarn}
        totalLiquidityLabel={totalLiquidityLabel}
        testID={EarnTestIDs.tokensPageItem(item.symbol)}
        onPress={() => handleAssetPress(item)}
      />
    ),
    [handleAssetPress, totalLiquidityLabel],
  );

  const keyExtractor = useCallback(
    (item: IEarnAvailableAsset) => item.symbol,
    [],
  );

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
        {TOKEN_CATEGORY_TYPES.map((type) => {
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
                {intl.formatMessage({ id: TOKEN_CATEGORY_LABEL_IDS[type] })}
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
        data={sortedAssets}
        estimatedItemSize={60}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isLoading ? <EarnTokensSkeleton /> : null}
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
