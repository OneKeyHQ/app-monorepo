import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useThrottledCallback } from 'use-debounce';

import {
  Badge,
  Empty,
  IconButton,
  SearchBar,
  SizableText,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { EarnNavigation } from '../earnUtils';

import { AprText } from './AprText';
import { buildEarnAvailableAssetCategoryTabs } from './earnCategoryTabs';

export function AvailableAssetsTabViewList() {
  const [{ availableAssetsByType = {}, refreshTrigger = 0 }] = useEarnAtom();
  const actions = useEarnActions();
  const intl = useIntl();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const media = useMedia();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountReady = activeAccount.ready;
  const activeNetworkId = activeAccount.network?.id;

  const tabData = useMemo(
    () => buildEarnAvailableAssetCategoryTabs(intl),
    [intl],
  );

  const TabNames = useMemo(() => {
    return tabData.map((item) => item.title);
  }, [tabData]);
  const focusedTab = useSharedValue(TabNames[0]);

  // Get filtered assets based on selected tab and search text
  const assets = useMemo(() => {
    const currentTabType = tabData[selectedTabIndex]?.type;
    const source = availableAssetsByType[currentTabType] || [];
    if (!searchText) return source;
    const query = searchText.toLowerCase();
    return source.filter(
      (a) =>
        a.symbol.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query),
    );
  }, [availableAssetsByType, selectedTabIndex, tabData, searchText]);

  // Use ref to track component mount status to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Throttled function to fetch assets data
  const fetchAssetsData = useThrottledCallback(
    async (tabType: EAvailableAssetsTypeEnum) => {
      // Early return if component is unmounted
      if (!isMountedRef.current) {
        return [];
      }

      const loadingKey = `availableAssets-${tabType}`;
      actions.current.setLoadingState(loadingKey, true);

      try {
        const tabAssets =
          await backgroundApiProxy.serviceStaking.getAvailableAssets({
            type: tabType,
          });

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          // Update the corresponding data in atom
          actions.current.updateAvailableAssetsByType(tabType, tabAssets);
        }
        return tabAssets;
      } catch (error) {
        console.error('Failed to fetch available assets:', error);
        // Return empty array on error to prevent infinite loading
        return [];
      } finally {
        // Only update loading state if component is still mounted
        if (isMountedRef.current) {
          actions.current.setLoadingState(loadingKey, false);
        }
      }
    },
    200,
    { leading: true, trailing: false },
  );

  // Load data for the selected tab
  usePromiseResult(
    async () => {
      const currentTabType = tabData[selectedTabIndex]?.type;
      if (currentTabType) {
        const result = await fetchAssetsData(currentTabType);
        return result || [];
      }
      return [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTabIndex, tabData, refreshTrigger, fetchAssetsData],
    {
      watchLoading: true,
      undefinedResultIfError: false, // Return empty array instead of undefined on error
    },
  );

  // Handle tab change
  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        focusedTab.value = name;
        setSelectedTabIndex(index);
      }
    },
    [focusedTab, tabData],
  );

  const columns: ITableColumn<IEarnAvailableAsset>[] = useMemo(
    () => [
      {
        key: 'asset',
        label: intl.formatMessage({ id: ETranslations.global_asset }),
        flex: 2,
        sortable: true,
        comparator: (a, b) => a.symbol.localeCompare(b.symbol),
        render: (asset) => (
          <XStack ai="center" gap="$3">
            <Token
              size="md"
              tokenImageUri={asset.logoURI}
              borderRadius="$full"
            />
            <SizableText size="$bodyLgMedium">{asset.symbol}</SizableText>
            <XStack gap="$1">
              {asset.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                  userSelect="none"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))}
            </XStack>
          </XStack>
        ),
      },
      {
        key: 'network',
        label: intl.formatMessage({ id: ETranslations.global_network }),
        flex: 1,
        hideInMobile: true,
        render: (asset) => (
          <NetworkAvatarGroup
            networkIds={Array.from(
              new Set(asset.protocols.map((p) => p.networkId)),
            )}
            size="$5"
            variant="spread"
            maxVisible={3}
          />
        ),
      },
      {
        key: 'yield',
        label: intl.formatMessage({ id: ETranslations.defi_apr_apy }),
        flex: 1,
        align: 'flex-end',
        sortable: true,
        comparator: (a, b) => {
          const aprA = parseFloat(a.aprWithoutFee || a.apr || '0');
          const aprB = parseFloat(b.aprWithoutFee || b.apr || '0');
          return aprA - aprB;
        },
        render: (asset) => <AprText asset={asset} />,
      },
    ],
    [intl],
  );

  // Navigate to asset detail or protocol list, reused by both table and search dialog
  const navigateToAsset = useCallback(
    async (
      asset: IEarnAvailableAsset,
      categoryType?: EAvailableAssetsTypeEnum,
    ) => {
      defaultLogger.staking.page.selectAsset({ tokenSymbol: asset.symbol });

      const defaultCategory =
        categoryType === EAvailableAssetsTypeEnum.SimpleEarn ||
        categoryType === EAvailableAssetsTypeEnum.FixedRate
          ? (categoryType as 'simpleEarn' | 'fixedRate')
          : undefined;
      const navigateToProtocolList = () => {
        EarnNavigation.pushToEarnProtocols(navigation, {
          symbol: asset.symbol,
          filterNetworkId: undefined,
          logoURI: asset.logoURI
            ? encodeURIComponent(asset.logoURI)
            : undefined,
          defaultCategory,
        });
      };

      // When current tab has only 1 protocol, check total across ALL categories.
      // A token like USDe may have 1 FixedRate protocol but multiple SimpleEarn
      // protocols — the user should still see the list page in that case.
      if (asset.protocols.length === 1) {
        const accountNetworkId =
          activeNetworkId ?? asset.protocols[0]?.networkId;
        const canQueryWithAccount =
          accountReady && Boolean(accountId) && Boolean(accountNetworkId);
        if (!canQueryWithAccount) {
          navigateToProtocolList();
          return;
        }

        let totalProtocols = 1;
        try {
          const allProtocols =
            await backgroundApiProxy.serviceStaking.getProtocolList({
              symbol: asset.symbol,
              accountId,
              networkId: accountNetworkId,
            });
          totalProtocols = allProtocols?.length ?? 1;
        } catch {
          // Fallback: use current tab's count
        }

        if (totalProtocols <= 1) {
          const protocol = asset.protocols[0];
          await EarnNavigation.pushToEarnProtocolDetails(navigation, {
            networkId: protocol.networkId,
            symbol: asset.symbol,
            provider: protocol.provider,
            vault: protocol.vault,
          });
          return;
        }
      }

      // Multiple protocols across categories → go to protocol list page
      navigateToProtocolList();
    },
    [navigation, accountId, accountReady, activeNetworkId],
  );

  // Handle row press in the main table
  const handleRowPress = useCallback(
    (asset: IEarnAvailableAsset) => {
      const currentTabType = tabData[selectedTabIndex]?.type;
      return navigateToAsset(asset, currentTabType);
    },
    [navigateToAsset, tabData, selectedTabIndex],
  );

  // Mobile custom renderer
  const mobileRenderItem = useCallback(
    (asset: IEarnAvailableAsset) => (
      <ListItem
        userSelect="none"
        onPress={() => handleRowPress(asset)}
        renderAvatar={
          <Token size="md" tokenImageUri={asset.logoURI} borderRadius="$full" />
        }
      >
        <ListItem.Text
          flex={1}
          primary={
            <XStack gap="$2" ai="center">
              <SizableText size="$bodyLgMedium">{asset.symbol}</SizableText>
              <XStack gap="$1">
                {asset.badges?.map((badge) => (
                  <Badge
                    key={badge.tag}
                    badgeType={badge.badgeType}
                    badgeSize="sm"
                    userSelect="none"
                  >
                    <Badge.Text>{badge.tag}</Badge.Text>
                  </Badge>
                ))}
              </XStack>
            </XStack>
          }
        />
        <XStack flex={1} ai="center" jc="flex-end">
          <XStack flexShrink={0} jc="flex-end">
            <AprText asset={asset} />
          </XStack>
        </XStack>
      </ListItem>
    ),
    [handleRowPress],
  );

  // Memoize keyExtractor for TableList
  const keyExtractor = useCallback(
    (asset: IEarnAvailableAsset) => asset.symbol,
    [],
  );

  // Memoize onPressRow wrapper for TableList
  const onPressRow = useCallback(
    (asset: IEarnAvailableAsset) => void handleRowPress(asset),
    [handleRowPress],
  );

  // Memoize TabBar renderItem
  const renderTabItem = useCallback(
    ({
      name,
      isFocused,
      onPress,
    }: {
      name: string;
      isFocused: boolean;
      onPress: (name: string) => void;
    }) => (
      <XStack
        px="$2"
        py="$1.5"
        mr="$1"
        bg={isFocused ? '$bgActive' : '$bg'}
        borderRadius="$2"
        borderCurve="continuous"
        onPress={() => onPress(name)}
      >
        <SizableText
          size="$bodyMdMedium"
          color={isFocused ? '$text' : '$textSubdued'}
          letterSpacing={-0.15}
        >
          {name}
        </SizableText>
      </XStack>
    ),
    [],
  );

  // Memoize SearchBar containerProps
  const searchBarContainerProps = useMemo(
    () => ({
      w: 200,
      borderRadius: '$full' as const,
      bg: '$bgStrong' as const,
      borderColor: '$transparent' as const,
      overflow: 'hidden' as const,
    }),
    [],
  );

  // Memoize ListEmptyComponent
  const listEmptyComponent = useMemo(
    () =>
      searchText ? (
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({
            id: ETranslations.global_search_no_results_title,
          })}
        />
      ) : null,
    [searchText, intl],
  );

  // Pre-fetch all categories and open search dialog
  const handleMobileSearchPress = useCallback(() => {
    void (async () => {
      setSearchLoading(true);
      try {
        const allTypes = [
          EAvailableAssetsTypeEnum.SimpleEarn,
          EAvailableAssetsTypeEnum.FixedRate,
          EAvailableAssetsTypeEnum.Staking,
        ];

        // Build complete data: use existing atom data + fetch missing categories
        const completeData: Partial<
          Record<EAvailableAssetsTypeEnum, IEarnAvailableAsset[]>
        > = { ...availableAssetsByType };

        const missingTypes = allTypes.filter(
          (type) => !completeData[type]?.length,
        );

        if (missingTypes.length > 0) {
          const results = await Promise.all(
            missingTypes.map(async (type) => {
              try {
                const data =
                  await backgroundApiProxy.serviceStaking.getAvailableAssets({
                    type,
                  });
                actions.current.updateAvailableAssetsByType(type, data);
                return { type, data };
              } catch {
                return { type, data: [] as IEarnAvailableAsset[] };
              }
            }),
          );

          for (const { type, data } of results) {
            completeData[type] = data;
          }
        }

        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.EarnAssetSearch,
          params: {
            availableAssetsByType: completeData,
            initialCategoryType:
              tabData[selectedTabIndex]?.type ??
              EAvailableAssetsTypeEnum.SimpleEarn,
            onAssetSelect: (asset, categoryType) => {
              void navigateToAsset(asset, categoryType);
            },
          },
        });
      } finally {
        setSearchLoading(false);
      }
    })();
  }, [
    availableAssetsByType,
    actions,
    navigateToAsset,
    navigation,
    selectedTabIndex,
    tabData,
  ]);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Mark component as unmounted
      isMountedRef.current = false;
      // Cancel any pending throttled calls
      fetchAssetsData.cancel();
    };
  }, [fetchAssetsData]);

  return (
    <YStack gap="$3">
      <XStack px="$pagePadding" ai="center" jc="space-between">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_available_assets })}
        </SizableText>
        {media.gtMd ? null : (
          <IconButton
            variant="tertiary"
            icon="SearchOutline"
            iconSize="$5"
            loading={searchLoading}
            disabled={searchLoading}
            onPress={handleMobileSearchPress}
          />
        )}
      </XStack>
      <XStack ai="center" jc="space-between" px="$pagePadding">
        <Tabs.TabBar
          containerStyle={{ px: '$0' }}
          divider={false}
          onTabPress={handleTabChange}
          tabNames={TabNames}
          focusedTab={focusedTab}
          renderItem={renderTabItem}
        />
        {media.gtMd ? (
          <SearchBar
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            onSearchTextChange={setSearchText}
            containerProps={searchBarContainerProps}
          />
        ) : null}
      </XStack>

      <TableList<IEarnAvailableAsset>
        key={`assets-tab-${selectedTabIndex}`}
        data={assets ?? []}
        columns={columns}
        keyExtractor={keyExtractor}
        withHeader={platformEnv.isNative ? false : media.gtMd}
        defaultSortKey="yield"
        defaultSortDirection="desc"
        onPressRow={onPressRow}
        mobileRenderItem={mobileRenderItem}
        enableDrillIn
        ListEmptyComponent={listEmptyComponent}
      />
    </YStack>
  );
}
