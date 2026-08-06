import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  SizableText,
  Skeleton,
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
import { prewarmTokenImages } from '@onekeyhq/kit/src/utils/tokenImagePrewarm';
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
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';

import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { earnListScrollBehaviorProps } from '../../components/earnListScrollProps';
import { EarnMobileSortControl } from '../../components/EarnMobileSortControl';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { NetworkFilterControl } from '../../components/NetworkFilterControl';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation } from '../../earnUtils';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';
import { parseAprPercentValue } from '../../utils/availableAssetsUtils';

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
  return parseAprPercentValue(row.item.provider.aprWithoutFee);
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

  // Asset logo map (OK-58881): protocol list rows carry no token logo, so
  // build a symbol→logoURI map from available-assets(all) (5-minute cache)
  const { result: allAssets, isLoading: isLogoMapLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.All,
      }),
    [],
    { watchLoading: true, undefinedResultIfError: true },
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

  // Network selector (OK-58881): filter rows by networkId
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

  // Tokens list for a single protocol: shows TVL, supports TVL/APY asc/desc
  // sorting (confirmed with product)
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
    // Direction labels use the shared high-to-low / low-to-high i18n (OK-58880)
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
      // OK-59304: hand the detail page the logo this row already resolved, so
      // it does not render the placeholder until its own request lands.
      // Note this is the token logo, not the page's `logoURI` route param,
      // which is the protocol's.
      const tokenLogoURI = assetLogoMap.get(row.symbol.toLowerCase());
      prewarmTokenImages({ tokenImageUri: tokenLogoURI });
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId: row.item.network.networkId,
        symbol: row.symbol,
        provider: row.item.provider.name,
        vault: row.item.provider.vault,
        logoURI: tokenLogoURI,
      });
    },
    [navigation, assetLogoMap],
  );

  const renderItem = useCallback(
    ({ item: row }: { item: IEarnProtocolTokenRow }) => (
      <ListItem
        testID={EarnTestIDs.protocolTokensItem(getRowKey(row))}
        userSelect="none"
        onPress={() => handleRowPress(row)}
        renderAvatar={
          // Asset logo (OK-58881). Do not fall back to the network
          // logo: before the map is ready it would flash a few frames of
          // the network image before swapping to the asset image; when
          // the map has no entry, prefer showing the placeholder
          <Token
            size="md"
            tokenImageUri={assetLogoMap.get(row.symbol.toLowerCase())}
            // Walkthrough r3: chain shown as a corner badge on the token logo
            // instead of a subtitle text line
            networkImageUri={row.item.network.logoURI}
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
        />
        <YStack ai="flex-end" jc="center" gap="$0.5">
          <EarnAprSuffixText
            text={
              row.item.aprInfo?.highlight?.text ??
              row.item.aprInfo?.normal?.text ??
              ''
            }
            // Append rewardUnit when the server copy has no suffix so
            // the APY/APR label always renders (OK-58881)
            fallbackUnit={row.item.provider.rewardUnit || 'APY'}
            color={
              row.item.aprInfo?.highlight
                ? (row.item.aprInfo.highlight.color ?? '$textSuccess')
                : (row.item.aprInfo?.normal?.color ?? '$text')
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
    ),
    [assetLogoMap, handleRowPress, intl],
  );

  const listHeader = (
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
  );

  const showSkeleton =
    (isLoading && sortedTokens.length === 0) ||
    (isLogoMapLoading === true && !allAssets);

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={
        // Title carries the protocol logo (OK-58881)
        <XStack ai="center" gap="$2">
          {logoURI ? (
            <Token size="sm" tokenImageUri={logoURI} borderRadius="$full" />
          ) : null}
          <SizableText size="$headingLg" numberOfLines={1}>
            {getEarnProviderDisplayName(providerName || provider)}
          </SizableText>
        </XStack>
      }
      showBackButton
      centerPageTitle
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      bodyListMode
    >
      {/* Virtualized full list (review feedback): the ListView owns the
          scrolling; controls scroll with the content as the list header.
          While the skeleton shows, hide the data rows by feeding an empty
          array so skeleton and rows never render together */}
      <ListView
        flex={1}
        {...earnListScrollBehaviorProps}
        data={showSkeleton ? [] : sortedTokens}
        estimatedItemSize={60}
        keyExtractor={getRowKey}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          showSkeleton ? <EarnProtocolTokensSkeleton /> : null
        }
        contentContainerStyle={{ pb: tabBarHeight }}
      />
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
