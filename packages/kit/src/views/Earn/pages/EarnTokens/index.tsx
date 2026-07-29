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

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';

type IEarnTokensSortKey = 'apy' | 'apr';

// Tokens 首页三分类 (设计稿：All / Stable Tokens / Non-Stable Tokens)
const TOKEN_CATEGORY_TYPES = [
  EAvailableAssetsTypeEnum.All,
  EAvailableAssetsTypeEnum.StableCoins,
  EAvailableAssetsTypeEnum.NativeTokens,
] as const;

// FIXME: Replace with product-approved i18n keys once available.
const TOKEN_CATEGORY_LABELS: Record<string, string> = {
  [EAvailableAssetsTypeEnum.All]: 'All',
  [EAvailableAssetsTypeEnum.StableCoins]: 'Stable Tokens',
  [EAvailableAssetsTypeEnum.NativeTokens]: 'Non-Stable Tokens',
};

function parseRate(value?: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssetSortValue(
  asset: IEarnAvailableAsset,
  sortKey: IEarnTokensSortKey,
): number {
  // APY = 含奖励综合年化 (apr 字段)；APR = 基础年化 (aprWithoutFee 字段)
  return sortKey === 'apy'
    ? parseRate(asset.apr)
    : parseRate(asset.aprWithoutFee);
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
  const [sortKey, setSortKey] = useState<IEarnTokensSortKey>('apy');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');

  // Tokens 首页仅 APY/APR 排序，不展示/不排序 TVL (汇总 TVL 无实际意义，产品确认)
  const { result: assets, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: categoryType,
      }),
    [categoryType],
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

  const sortOptions = useMemo<IEarnSortOption[]>(() => {
    const apyLabel = 'APY';
    const aprLabel = 'APR';
    return [
      {
        label: `${apyLabel} ↓`,
        triggerLabel: apyLabel,
        value: 'apy',
        direction: 'desc',
      },
      {
        label: `${apyLabel} ↑`,
        triggerLabel: apyLabel,
        value: 'apy',
        direction: 'asc',
      },
      {
        label: `${aprLabel} ↓`,
        triggerLabel: aprLabel,
        value: 'apr',
        direction: 'desc',
      },
      {
        label: `${aprLabel} ↑`,
        triggerLabel: aprLabel,
        value: 'apr',
        direction: 'asc',
      },
    ];
  }, []);

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

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      // FIXME: Replace with product-approved i18n key once available (与
      // EarnHomeShortcuts 的 "Tokens" 标签保持一致)。
      pageTitle={<SizableText size="$headingLg">Tokens</SizableText>}
      showBackButton
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      contentContainerStyle={{ pb: tabBarHeight }}
    >
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
                {TOKEN_CATEGORY_LABELS[type]}
              </SizableText>
            </XStack>
          );
        })}
      </XStack>
      {isLoading && sortedAssets.length === 0 ? (
        <EarnTokensSkeleton />
      ) : (
        <Stack>
          {sortedAssets.map((asset) => (
            <AvailableAssetItem
              key={asset.symbol}
              asset={asset}
              categoryType={EAvailableAssetsTypeEnum.SimpleEarn}
              totalLiquidityLabel={totalLiquidityLabel}
              testID={EarnTestIDs.tokensPageItem(asset.symbol)}
              onPress={() => handleAssetPress(asset)}
            />
          ))}
        </Stack>
      )}
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
