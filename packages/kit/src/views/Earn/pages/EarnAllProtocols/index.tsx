import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  NumberSizeableText,
  SearchBar,
  SizableText,
  Skeleton,
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

import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { EarnListEmptyState } from '../../components/EarnListEmptyState';
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
import { EarnNavigation } from '../../earnUtils';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';
import { parseAprPercentValue } from '../../utils/availableAssetsUtils';

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
  // Reward unit of the row that produced maxApy (review P2): rendering a
  // fixed "APY" would mislabel APR protocols
  maxApyUnit: string;
  // Server-driven highlight color of that same row (OK-59344): only boosted
  // rows carry a highlight color, everything else renders in default text
  maxApyColor?: string;
  // Server copy of that same row (OK-59855). Protocols without a numeric
  // yield (babylon returns the translated "Earn points") carry their whole
  // value as text, so re-formatting from the parsed number would drop it.
  maxApyText?: string;
};

function getRowApy(row: IEarnProtocolTokenRow): number {
  return parseAprPercentValue(row.item.provider.aprWithoutFee);
}

function getRowAprText(row: IEarnProtocolTokenRow): string | undefined {
  const text =
    row.item.aprInfo?.highlight?.text ?? row.item.aprInfo?.normal?.text;
  return text?.trim() || undefined;
}

function EarnAllProtocolsSkeleton() {
  return (
    // Same box metrics and row gap as the real ListItem rows so the
    // skeleton-to-content swap does not shift the list (OK-59904)
    <YStack px="$pagePadding" gap={EARN_LIST_ROW_GAP}>
      {Array.from({ length: 8 }).map((_, index) => (
        <XStack key={index} minHeight="$11" py="$2" ai="center" gap="$3">
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
  // Two-dimension sorting: TVL / APY-APR (OK-58880 requirement 4)
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

  // Recompute TVL from the remaining token rows after network filtering;
  // search filters by protocol name
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
      let maxApy = 0;
      let maxApyUnit = 'APY';
      let maxApyColor: string | undefined;
      let maxApyText: string | undefined;
      // Text-only yields parse to 0, so they can never win the numeric
      // comparison; remember the first one as a fallback for providers whose
      // every row is text-only (OK-59855)
      let textOnlyRow: IEarnProtocolTokenRow | undefined;
      for (const row of rows) {
        const apy = getRowApy(row);
        if (apy > maxApy) {
          maxApy = apy;
          maxApyUnit = row.item.provider.rewardUnit || 'APY';
          maxApyColor = row.item.aprInfo?.highlight?.color;
          maxApyText = getRowAprText(row);
        } else if (!textOnlyRow && apy <= 0 && getRowAprText(row)) {
          textOnlyRow = row;
        }
      }
      if (maxApy <= 0 && textOnlyRow) {
        maxApyUnit = textOnlyRow.item.provider.rewardUnit || 'APY';
        maxApyColor = textOnlyRow.item.aprInfo?.highlight?.color;
        maxApyText = getRowAprText(textOnlyRow);
      }
      return [
        {
          ...provider,
          filteredTvlValue: rows.reduce((sum, row) => sum + row.tvlValue, 0),
          maxApy,
          maxApyUnit,
          maxApyColor,
          maxApyText,
        },
      ];
    });
  }, [providers, searchText, selectedNetworkIds]);

  // Protocols home: TVL / APY-APR sorting (OK-58880)
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

  const renderItem = useCallback(
    ({ item: provider }: { item: IFilteredProvider }) => {
      // Prefer the server copy so text-only yields survive (OK-59855); the
      // parsed number stays the sort key and the numeric fallback.
      const yieldText =
        provider.maxApyText ??
        (provider.maxApy > 0 ? `${provider.maxApy.toFixed(2)}%` : undefined);
      // Appending a unit only makes sense for a numeric value — "Earn points
      // APY" would be nonsense.
      const yieldUnit =
        yieldText && /\d/.test(yieldText) ? provider.maxApyUnit : undefined;

      return (
        <ListItem
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
            {yieldText ? (
              // Value + smaller APY suffix via the shared renderer instead
              // of hard-coding the unit into the copy (review feedback).
              // OK-59344: default text color — green is reserved for boosted
              // rows and is driven by the server-side aprInfo color, so a
              // hardcoded success color made every protocol look boosted.
              <EarnAprSuffixText
                text={yieldText}
                fallbackUnit={yieldUnit}
                size="$bodyMdMedium"
                suffixSize="$bodySmMedium"
                color={provider.maxApyColor ?? '$text'}
              />
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
      );
    },
    [handleProviderPress, intl],
  );

  const keyExtractor = useCallback(
    (item: IFilteredProvider) => item.provider,
    [],
  );

  // Passed as an element (stable component type), so re-renders reconcile
  // in place and the SearchBar keeps focus while typing
  const listHeader = (
    <>
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
    </>
  );

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_protocols__title })}
        </SizableText>
      }
      showBackButton
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      bodyListMode
    >
      {/* Virtualized full list (review feedback): the ListView owns the
          scrolling; controls scroll with the content as the list header */}
      <ListView
        flex={1}
        {...earnListScrollBehaviorProps}
        data={sortedProviders}
        estimatedItemSize={EARN_LIST_ESTIMATED_ITEM_SIZE}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={EarnListRowSeparator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading ? (
            <EarnAllProtocolsSkeleton />
          ) : (
            <EarnListEmptyState
              isFiltered={
                searchText.trim().length > 0 || selectedNetworkIds.length > 0
              }
            />
          )
        }
        contentContainerStyle={{ pb: tabBarHeight }}
      />
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
