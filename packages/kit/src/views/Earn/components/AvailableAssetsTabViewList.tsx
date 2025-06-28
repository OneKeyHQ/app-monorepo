import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useThrottledCallback } from 'use-debounce';

import {
  Badge,
  IconButton,
  SizableText,
  Skeleton,
  Tab,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITabHeaderInstance } from '@onekeyhq/components/src/layouts/TabView/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnRewardUnit } from '@onekeyhq/shared/types/staking';

// Helper function to build APR text
const buildAprText = (apr: string, unit: IEarnRewardUnit) => `${apr} ${unit}`;

// Skeleton component for loading state
function AvailableAssetsSkeleton() {
  const media = useMedia();

  return (
    <YStack
      mx="$-5"
      $gtLg={{
        mx: 0,
        overflow: 'hidden',
        bg: '$bg',
        borderRadius: '$3',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
        borderCurve: 'continuous',
      }}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <ListItem
          key={index}
          mx="$0"
          px="$4"
          {...(media.gtLg
            ? {
                borderRadius: '$0',
              }
            : {})}
          {...(index !== 0 && media.gtLg
            ? {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: '$borderSubdued',
              }
            : {})}
        >
          <XStack
            flex={1}
            alignItems="center"
            justifyContent="space-between"
            gap="$4"
          >
            <XStack ai="center" gap="$4">
              <Skeleton
                width={media.gtLg ? '$8' : '$10'}
                height={media.gtLg ? '$8' : '$10'}
                radius="round"
              />
              <Skeleton w={60} h={20} borderRadius="$2" />
            </XStack>

            <Skeleton w={90} h={20} borderRadius="$2" />

            {media.gtLg ? (
              <IconButton icon="ChevronRightSmallOutline" variant="tertiary" />
            ) : null}
          </XStack>
        </ListItem>
      ))}
    </YStack>
  );
}

interface IAvailableAssetsTabViewListProps {
  onTokenPress?: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  }) => Promise<void>;
}

export function AvailableAssetsTabViewList({
  onTokenPress,
}: IAvailableAssetsTabViewListProps) {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ availableAssetsByType = {}, refreshTrigger = 0 }] = useEarnAtom();
  const actions = useEarnActions();
  const intl = useIntl();
  const media = useMedia();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const tabHeaderRef = useRef<ITabHeaderInstance>(null);

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

  // Get filtered assets based on selected tab
  const assets = useMemo(() => {
    const currentTabType = tabData[selectedTabIndex]?.type;
    return availableAssetsByType[currentTabType] || [];
  }, [availableAssetsByType, selectedTabIndex, tabData]);

  // Throttled function to fetch assets data
  const fetchAssetsData = useThrottledCallback(
    async (tabType: EAvailableAssetsTypeEnum) => {
      const tabAssets =
        await backgroundApiProxy.serviceStaking.getAvailableAssets({
          type: tabType,
        });

      // Update the corresponding data in atom
      actions.current.updateAvailableAssetsByType(tabType, tabAssets);
      return tabAssets;
    },
    timerUtils.getTimeDurationMs({ seconds: 2 }),
    { leading: true, trailing: false },
  );

  // Load data for the selected tab
  const { isLoading } = usePromiseResult(
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
    },
  );

  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    setSelectedTabIndex(index);
  }, []);

  // Update tab header when selectedTabIndex changes
  useEffect(() => {
    if (tabHeaderRef.current) {
      tabHeaderRef.current.scrollToIndex(selectedTabIndex);
    }
  }, [selectedTabIndex]);

  if (assets.length || isLoading) {
    return (
      <YStack gap="$3">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_available_assets })}
        </SizableText>
        <Tab.Header
          ref={tabHeaderRef}
          style={{
            height: 28,
            borderBottomWidth: 0,
          }}
          data={tabData}
          itemContainerStyle={{
            px: '$2',
            mr: '$1',
            cursor: 'default',
          }}
          itemTitleNormalStyle={{
            color: '$textSubdued',
            fontSize: 14,
            fontWeight: '500',
            lineHeight: 20,
            letterSpacing: -0.15,
          }}
          itemTitleSelectedStyle={{
            color: '$text',
            fontSize: 14,
            fontWeight: '500',
            lineHeight: 20,
            letterSpacing: -0.15,
          }}
          cursorStyle={{
            height: '100%',
            bg: '$bgActive',
            borderRadius: '$2',
            borderCurve: 'continuous',
          }}
          onSelectedPageIndex={handleTabChange}
        />

        {isLoading ? (
          <AvailableAssetsSkeleton />
        ) : (
          <YStack
            mx="$-5"
            $gtLg={{
              mx: 0,
              overflow: 'hidden',
              bg: '$bg',
              borderRadius: '$3',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$borderSubdued',
              borderCurve: 'continuous',
            }}
          >
            {assets.map(
              (
                {
                  name,
                  logoURI,
                  aprWithoutFee,
                  symbol,
                  rewardUnit,
                  badges = [],
                  protocols,
                },
                index,
              ) => (
                <ListItem
                  userSelect="none"
                  key={`${name}-${index}`}
                  onPress={async () => {
                    await onTokenPress?.({
                      networkId: protocols[0]?.networkId || '',
                      accountId: account?.id ?? '',
                      indexedAccountId: indexedAccount?.id,
                      symbol,
                      protocols,
                    });
                  }}
                  avatarProps={{
                    src: logoURI,
                    fallbackProps: {
                      borderRadius: '$full',
                    },
                    ...(media.gtLg
                      ? {
                          size: '$8',
                        }
                      : {}),
                  }}
                  {...(media.gtLg
                    ? {
                        drillIn: true,
                        mx: '$0',
                        px: '$4',
                        borderRadius: '$0',
                      }
                    : {})}
                  {...(index !== 0 && media.gtLg
                    ? {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: '$borderSubdued',
                      }
                    : {})}
                >
                  <ListItem.Text
                    flexGrow={1}
                    flexBasis={0}
                    primary={
                      <XStack gap="$2" alignItems="center">
                        <SizableText size="$bodyLgMedium">{symbol}</SizableText>
                        <XStack gap="$1">
                          {badges.map((badge) => (
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
                  <XStack
                    flex={1}
                    ai="center"
                    jc="flex-end"
                    $gtLg={{
                      jc: 'flex-start',
                    }}
                  >
                    <XStack
                      flexShrink={0}
                      $gtLg={{
                        width: 120,
                      }}
                      justifyContent="flex-end"
                    >
                      <SizableText size="$bodyLgMedium" textAlign="right">
                        {buildAprText(aprWithoutFee, rewardUnit)}
                      </SizableText>
                    </XStack>
                  </XStack>
                </ListItem>
              ),
            )}
          </YStack>
        )}
      </YStack>
    );
  }
  return null;
}
