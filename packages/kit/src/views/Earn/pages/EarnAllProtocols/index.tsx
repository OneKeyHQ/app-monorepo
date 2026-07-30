import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';

import type {
  IEarnSortDirection,
  IEarnSortOption,
} from '../../components/EarnMobileSortControl';
import type {
  IEarnAggregatedProvider,
  IEarnProtocolTokenRow,
} from '../../hooks/useEarnAllProtocols';

type IFilteredProvider = IEarnAggregatedProvider & {
  filteredTvlValue: number;
  maxApy: number;
};

function getRowApy(row: IEarnProtocolTokenRow): number {
  const parsed = Number(row.item.provider.aprWithoutFee);
  return Number.isFinite(parsed) ? parsed : 0;
}

function EarnAllProtocolsSkeleton() {
  return (
    <YStack px="$pagePadding" gap="$4" pt="$4">
      {Array.from({ length: 8 }).map((_, index) => (
        <XStack key={index} ai="center" gap="$3">
          <Skeleton w="$10" h="$10" borderRadius="$full" />
          <YStack gap="$1.5" flex={1}>
            <Skeleton h="$4" w="$24" />
          </YStack>
          <Skeleton h="$4" w="$20" />
        </XStack>
      ))}
    </YStack>
  );
}

function EarnAllProtocolsContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tabBarHeight = useScrollContentTabBarOffset();
  const { providers, isLoading } = useEarnAllProtocols();

  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  // TVL / APY-APR 双维度排序 (OK-58880 需求4)
  const [sortKey, setSortKey] = useState<'tvl' | 'apy'>('tvl');
  const [sortDirection, setSortDirection] =
    useState<IEarnSortDirection>('desc');

  const { availableNetworkIds, networkAssetCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const provider of providers) {
      const networkIds = new Set(
        provider.tokens.map((row) => row.item.network.networkId),
      );
      for (const networkId of networkIds) {
        counts[networkId] = (counts[networkId] ?? 0) + 1;
      }
    }
    return {
      availableNetworkIds: Object.keys(counts),
      networkAssetCounts: counts,
    };
  }, [providers]);

  // 网络筛选后按剩余 token 行重算 TVL；搜索按协议名过滤
  const filteredProviders = useMemo<IFilteredProvider[]>(() => {
    const selectedSet = new Set(selectedNetworkIds);
    const keyword = searchText.trim().toLowerCase();
    return providers.flatMap((provider) => {
      if (keyword && !provider.providerName.toLowerCase().includes(keyword)) {
        return [];
      }
      const rows =
        selectedSet.size > 0
          ? provider.tokens.filter((row) =>
              selectedSet.has(row.item.network.networkId),
            )
          : provider.tokens;
      if (rows.length === 0) {
        return [];
      }
      return [
        {
          ...provider,
          filteredTvlValue: rows.reduce((sum, row) => sum + row.tvlValue, 0),
          maxApy: Math.max(...rows.map((row) => getRowApy(row))),
        },
      ];
    });
  }, [providers, searchText, selectedNetworkIds]);

  // Protocols 首页：TVL / APY-APR 排序 (OK-58880)
  const sortedProviders = useMemo(
    () =>
      filteredProviders.toSorted((providerA, providerB) => {
        const valueA =
          sortKey === 'tvl' ? providerA.filteredTvlValue : providerA.maxApy;
        const valueB =
          sortKey === 'tvl' ? providerB.filteredTvlValue : providerB.maxApy;
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }),
    [filteredProviders, sortDirection, sortKey],
  );

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
      setSortKey(key as 'tvl' | 'apy');
      setSortDirection(direction);
    },
    [],
  );

  const handleProviderPress = useCallback(
    (provider: IEarnAggregatedProvider) => {
      EarnNavigation.pushToEarnProtocolTokens(navigation, {
        provider: provider.provider,
        providerName: provider.providerName,
        logoURI: provider.logoURI,
      });
    },
    [navigation],
  );

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      // FIXME: Replace with product-approved i18n key once available (与
      // EarnHomeShortcuts 的 "Protocols" 标签保持一致)。
      pageTitle={<SizableText size="$headingLg">Protocols</SizableText>}
      showBackButton
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      contentContainerStyle={{ pb: tabBarHeight }}
    >
      <YStack px="$pagePadding" pb="$2">
        <SearchBar
          testID={EarnTestIDs.allProtocolsSearchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={intl.formatMessage({
            id: ETranslations.global_search,
          })}
        />
      </YStack>
      <XStack px="$pagePadding" py="$2" ai="center" jc="space-between">
        <NetworkFilterControl
          testID={EarnTestIDs.allProtocolsNetworkFilter}
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
          testID={EarnTestIDs.allProtocolsSortControl}
        />
      </XStack>
      {isLoading && sortedProviders.length === 0 ? (
        <EarnAllProtocolsSkeleton />
      ) : (
        <Stack>
          {sortedProviders.map((provider) => (
            <ListItem
              key={provider.provider}
              testID={EarnTestIDs.allProtocolsItem(provider.provider)}
              userSelect="none"
              onPress={() => handleProviderPress(provider)}
              renderAvatar={
                <Token
                  size="md"
                  tokenImageUri={provider.logoURI}
                  borderRadius="$full"
                />
              }
            >
              <ListItem.Text
                flex={1}
                primary={
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {provider.providerName}
                  </SizableText>
                }
              />
              <YStack ai="flex-end" jc="center">
                {provider.maxApy > 0 ? (
                  <SizableText size="$bodyMdMedium" color="$textSuccess">
                    {`${provider.maxApy.toFixed(2)}% APY`}
                  </SizableText>
                ) : null}
                <XStack ai="center" gap="$1">
                  <NumberSizeableText
                    size="$bodySm"
                    color="$textSubdued"
                    formatter="marketCap"
                    formatterOptions={{ currency: '$' }}
                  >
                    {provider.filteredTvlValue}
                  </NumberSizeableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({ id: ETranslations.earn_tvl })}
                  </SizableText>
                </XStack>
              </YStack>
            </ListItem>
          ))}
        </Stack>
      )}
    </EarnPageContainer>
  );
}

export default function EarnAllProtocols() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnAllProtocolsContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
