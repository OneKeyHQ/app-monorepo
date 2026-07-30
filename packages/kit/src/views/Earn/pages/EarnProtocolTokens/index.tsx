import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { capitalizeString } from '../../../Staking/utils/utils';
import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';
import type { IEarnProtocolTokenRow } from '../../hooks/useEarnAllProtocols';
import type { RouteProp } from '@react-navigation/core';

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnProtocolTokens
>;

type IProtocolTokensSortKey = 'tvl' | 'apy';

function getRowAprValue(row: IEarnProtocolTokenRow): number {
  const parsed = Number(row.item.provider.aprWithoutFee);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRowKey(row: IEarnProtocolTokenRow): string {
  return [
    row.symbol,
    row.item.network.networkId,
    row.item.provider.vault ?? '',
  ].join('-');
}

function EarnProtocolTokensSkeleton() {
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

function EarnProtocolTokensContent({ route }: { route: IRouteProps }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { provider, providerName, logoURI } = route.params;
  const { providers, isLoading } = useEarnAllProtocols();

  // 资产 logo 映射 (OK-58881)：协议列表行数据里没有 token logo，
  // 从 available-assets(all) 建 symbol→logoURI 映射（5 分钟缓存）
  const { result: allAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.All,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const assetLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of allAssets ?? []) {
      map.set(asset.symbol.toLowerCase(), asset.logoURI);
    }
    return map;
  }, [allAssets]);

  const [sortKey, setSortKey] = useState<IProtocolTokensSortKey>('tvl');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);

  const allTokens = useMemo(
    () =>
      providers.find(
        (aggregated) => aggregated.provider === provider.toLowerCase(),
      )?.tokens ?? [],
    [provider, providers],
  );

  // 网络选择器 (OK-58881)：按行的 networkId 过滤
  const { availableNetworkIds, networkAssetCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of allTokens) {
      const networkId = row.item.network.networkId;
      counts[networkId] = (counts[networkId] ?? 0) + 1;
    }
    return {
      availableNetworkIds: Object.keys(counts),
      networkAssetCounts: counts,
    };
  }, [allTokens]);

  const tokens = useMemo(() => {
    if (selectedNetworkIds.length === 0) {
      return allTokens;
    }
    const selectedSet = new Set(selectedNetworkIds);
    return allTokens.filter((row) =>
      selectedSet.has(row.item.network.networkId),
    );
  }, [allTokens, selectedNetworkIds]);

  // 某个 Protocol 的 Tokens 列表：展示 TVL，支持 TVL/APY 升降序 (产品确认)
  const sortedTokens = useMemo(
    () =>
      tokens.toSorted((rowA, rowB) => {
        const valueA = sortKey === 'tvl' ? rowA.tvlValue : getRowAprValue(rowA);
        const valueB = sortKey === 'tvl' ? rowB.tvlValue : getRowAprValue(rowB);
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }),
    [sortDirection, sortKey, tokens],
  );

  const sortOptions = useMemo<IEarnSortOption[]>(() => {
    const tvlLabel = intl.formatMessage({ id: ETranslations.earn_tvl });
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
  }, [intl]);

  const handleSortChange = useCallback(
    (key: string, direction: IEarnSortDirection) => {
      setSortKey(key as IProtocolTokensSortKey);
      setSortDirection(direction);
    },
    [],
  );

  const handleRowPress = useCallback(
    (row: IEarnProtocolTokenRow) => {
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId: row.item.network.networkId,
        symbol: row.symbol,
        provider: row.item.provider.name,
        vault: row.item.provider.vault,
      });
    },
    [navigation],
  );

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={
        // 标题带协议 logo (OK-58881)
        <XStack ai="center" gap="$2">
          {logoURI ? (
            <Token size="sm" tokenImageUri={logoURI} borderRadius="$full" />
          ) : null}
          <SizableText size="$headingLg" numberOfLines={1}>
            {capitalizeString(providerName || provider)}
          </SizableText>
        </XStack>
      }
      showBackButton
      centerPageTitle
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      contentContainerStyle={{ pb: tabBarHeight }}
    >
      <XStack px="$pagePadding" py="$2" ai="center" jc="space-between">
        <NetworkFilterControl
          testID={EarnTestIDs.protocolTokensNetworkFilter}
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
          testID={EarnTestIDs.protocolTokensSortControl}
        />
      </XStack>
      {isLoading && sortedTokens.length === 0 ? (
        <EarnProtocolTokensSkeleton />
      ) : (
        <Stack>
          {sortedTokens.map((row) => (
            <ListItem
              key={getRowKey(row)}
              testID={EarnTestIDs.protocolTokensItem(getRowKey(row))}
              userSelect="none"
              onPress={() => handleRowPress(row)}
              renderAvatar={
                // 资产 logo，而非网络/协议 logo (OK-58881)
                <Token
                  size="md"
                  tokenImageUri={
                    assetLogoMap.get(row.symbol.toLowerCase()) ??
                    row.item.network.logoURI
                  }
                  borderRadius="$full"
                />
              }
            >
              <ListItem.Text
                flex={1}
                primary={
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {row.symbol}
                  </SizableText>
                }
                secondary={
                  // 即使同一网络也恒定显示 network (OK-58881)
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {row.item.network.name}
                  </SizableText>
                }
              />
              <YStack ai="flex-end" jc="center" gap="$0.5">
                <EarnAprSuffixText
                  text={
                    row.item.aprInfo?.highlight?.text ??
                    row.item.aprInfo?.normal?.text ??
                    ''
                  }
                  // 服务端文案无后缀时补 rewardUnit，保证 APY/APR 字样展示 (OK-58881)
                  fallbackUnit={row.item.provider.rewardUnit || 'APY'}
                  color={
                    row.item.aprInfo?.highlight
                      ? row.item.aprInfo.highlight.color ?? '$textSuccess'
                      : row.item.aprInfo?.normal?.color ?? '$text'
                  }
                />
                {row.item.tvl?.text ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {`${row.item.tvl.text} ${intl.formatMessage({
                      id: ETranslations.earn_tvl,
                    })}`}
                  </SizableText>
                ) : null}
              </YStack>
            </ListItem>
          ))}
        </Stack>
      )}
    </EarnPageContainer>
  );
}

export default function EarnProtocolTokens(props: { route: IRouteProps }) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnProtocolTokensContent {...props} />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
