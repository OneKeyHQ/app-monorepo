import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';
import { useThrottledCallback } from 'use-debounce';

import {
  Badge,
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
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { EarnNavigation } from '../earnUtils';

import { AprText } from './AprText';

export function AvailableAssetsTabViewList() {
  const [{ availableAssetsByType = {}, refreshTrigger = 0 }] = useEarnAtom();
  const actions = useEarnActions();
  const intl = useIntl();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const media = useMedia();
  const navigation = useAppNavigation();

  const tabData = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.global_all }),
        type: EAvailableAssetsTypeEnum.All,
      },
      {
        // eslint-disable-next-line spellcheck/spell-checker
        title: intl.formatMessage({ id: ETranslations.earn_stablecoins }),
        type: EAvailableAssetsTypeEnum.StableCoins,
      },
      {
        title: intl.formatMessage({ id: ETranslations.earn_native_tokens }),
        type: EAvailableAssetsTypeEnum.NativeTokens,
      },
    ],
    [intl],
  );

  const TabNames = useMemo(() => {
    return tabData.map((item) => item.title);
  }, [tabData]);
  const focusedTab = useSharedValue(TabNames[0]);

  // Get filtered assets based on selected tab
  const assets = useMemo(() => {
    const currentTabType = tabData[selectedTabIndex]?.type;
    return availableAssetsByType[currentTabType] || [];
  }, [availableAssetsByType, selectedTabIndex, tabData]);

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

  // Handle row press
  const handleRowPress = useCallback(
    async (asset: IEarnAvailableAsset) => {
      defaultLogger.staking.page.selectAsset({ tokenSymbol: asset.symbol });

      if (asset.protocols.length === 1) {
        const protocol = asset.protocols[0];
        await EarnNavigation.pushToEarnProtocolDetails(navigation, {
          networkId: protocol.networkId,
          symbol: asset.symbol,
          provider: protocol.provider,
          vault: protocol.vault,
        });
      } else {
        EarnNavigation.pushToEarnProtocols(navigation, {
          symbol: asset.symbol,
          filterNetworkId: undefined,
          logoURI: asset.logoURI
            ? encodeURIComponent(asset.logoURI)
            : undefined,
        });
      }
    },
    [navigation],
  );

  // Mobile custom renderer
  const mobileRenderItem = useCallback(
    (asset: IEarnAvailableAsset) => (
      <ListItem
        userSelect="none"
        onPress={() => handleRowPress(asset)}
        avatarProps={{
          src: asset.logoURI,
          fallbackProps: {
            borderRadius: '$full',
          },
        }}
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
      <SizableText px="$5" size="$headingLg">
        {intl.formatMessage({ id: ETranslations.earn_available_assets })}
      </SizableText>
      <Tabs.TabBar
        containerStyle={{ px: '$5' }}
        divider={false}
        onTabPress={handleTabChange}
        tabNames={TabNames}
        focusedTab={focusedTab}
        renderItem={({ name, isFocused, onPress }) => (
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
        )}
      />

      <TableList<IEarnAvailableAsset>
        key={`assets-tab-${selectedTabIndex}`}
        data={assets ?? []}
        columns={columns}
        keyExtractor={(asset) => asset.symbol}
        withHeader={platformEnv.isNative ? false : media.gtSm}
        defaultSortKey="yield"
        defaultSortDirection="desc"
        onPressRow={(asset) => void handleRowPress(asset)}
        mobileRenderItem={mobileRenderItem}
        enableDrillIn
      />
    </YStack>
  );
}
