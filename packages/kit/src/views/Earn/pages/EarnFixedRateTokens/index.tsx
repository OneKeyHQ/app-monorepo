import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
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
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { useNavigateToEarnAsset } from '../../hooks/useNavigateToEarnAsset';
import { EarnTestIDs } from '../../testIDs';
import { parseFormattedLiquidityValue } from '../../utils/availableAssetsUtils';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';

type IFixedRateSortKey = 'liquidity' | 'apy';

function parseRate(value?: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssetSortValue(
  asset: IEarnAvailableAsset,
  sortKey: IFixedRateSortKey,
): number {
  return sortKey === 'liquidity'
    ? parseFormattedLiquidityValue(asset.liquidity)
    : parseRate(asset.aprWithoutFee || asset.apr);
}

function EarnFixedRateTokensSkeleton() {
  return (
    <YStack px="$pagePadding" gap="$4" pt="$4">
      {Array.from({ length: 8 }).map((_, index) => (
        <XStack key={index} ai="center" gap="$3">
          <Skeleton w="$10" h="$10" borderRadius="$full" />
          <YStack gap="$1.5" flex={1}>
            <Skeleton h="$4" w="$24" />
          </YStack>
          <YStack ai="flex-end" gap="$1.5">
            <Skeleton h="$4" w="$16" />
            <Skeleton h="$3" w="$20" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function EarnFixedRateTokensContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const navigateToAsset = useNavigateToEarnAsset();

  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<IFixedRateSortKey>('liquidity');
  // 默认 Liquidity High to Low (OK-58879)
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');

  const { result: assets, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.FixedRate,
      }),
    [],
    { watchLoading: true, undefinedResultIfError: true },
  );

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
  }, [assets, searchText, selectedNetworkIds]);

  const sortedAssets = useMemo(
    () =>
      filteredAssets.toSorted((assetA, assetB) => {
        const valueA = getAssetSortValue(assetA, sortKey);
        const valueB = getAssetSortValue(assetB, sortKey);
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }),
    [filteredAssets, sortDirection, sortKey],
  );

  const totalLiquidityLabel = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.dexmarket_details_liquidity_change_total,
      }),
    [intl],
  );

  const sortOptions = useMemo<IEarnSortOption[]>(() => {
    const liquidityLabel = totalLiquidityLabel;
    const yieldLabel = intl.formatMessage({ id: ETranslations.defi_apr_apy });
    // 方向文案统一用 high-to-low / low-to-high i18n (OK-58880)
    const highToLow = intl.formatMessage({
      id: ETranslations.high_to_low__action,
    });
    const lowToHigh = intl.formatMessage({
      id: ETranslations.low_to_high__action,
    });
    return [
      {
        label: `${liquidityLabel} ${highToLow}`,
        triggerLabel: liquidityLabel,
        value: 'liquidity',
        direction: 'desc',
      },
      {
        label: `${liquidityLabel} ${lowToHigh}`,
        triggerLabel: liquidityLabel,
        value: 'liquidity',
        direction: 'asc',
      },
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
    ];
  }, [intl, totalLiquidityLabel]);

  const handleSortChange = useCallback(
    (key: string, direction: IEarnSortDirection) => {
      setSortKey(key as IFixedRateSortKey);
      setSortDirection(direction);
    },
    [],
  );

  const handleAssetPress = useCallback(
    (asset: IEarnAvailableAsset) => {
      void navigateToAsset(asset, EAvailableAssetsTypeEnum.FixedRate);
    },
    [navigateToAsset],
  );

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_fixed_income })}
        </SizableText>
      }
      showBackButton
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      contentContainerStyle={{ pb: tabBarHeight }}
    >
      <YStack px="$pagePadding" pb="$2">
        <SearchBar
          testID={EarnTestIDs.fixedRateSearchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={intl.formatMessage({
            id: ETranslations.global_search,
          })}
        />
      </YStack>
      <XStack px="$pagePadding" py="$2" ai="center" jc="space-between">
        <NetworkFilterControl
          testID={EarnTestIDs.fixedRateNetworkFilter}
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
          testID={EarnTestIDs.fixedRateSortControl}
        />
      </XStack>
      {isLoading && sortedAssets.length === 0 ? (
        <EarnFixedRateTokensSkeleton />
      ) : (
        <Stack>
          {sortedAssets.map((asset) => (
            <AvailableAssetItem
              key={asset.symbol}
              asset={asset}
              categoryType={EAvailableAssetsTypeEnum.FixedRate}
              totalLiquidityLabel={totalLiquidityLabel}
              testID={EarnTestIDs.fixedRateItem(asset.symbol)}
              onPress={() => handleAssetPress(asset)}
            />
          ))}
        </Stack>
      )}
    </EarnPageContainer>
  );
}

export default function EarnFixedRateTokens() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnFixedRateTokensContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
