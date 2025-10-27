import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useThrottledCallback } from 'use-debounce';

import {
  Badge,
  IconButton,
  SizableText,
  Skeleton,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { AprText } from './AprText';
import { FAQPanel } from './FAQPanel';

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

  // Throttled function to fetch assets data
  const fetchAssetsData = useThrottledCallback(
    async (tabType: EAvailableAssetsTypeEnum) => {
      const loadingKey = `availableAssets-${tabType}`;
      actions.current.setLoadingState(loadingKey, true);

      try {
        const tabAssets =
          await backgroundApiProxy.serviceStaking.getAvailableAssets({
            type: tabType,
          });

        // Update the corresponding data in atom
        actions.current.updateAvailableAssetsByType(tabType, tabAssets);
        return tabAssets;
      } finally {
        actions.current.setLoadingState(loadingKey, false);
      }
    },
    200,
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

  if (assets.length || isLoading) {
    return (
      <YStack gap="$3">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_available_assets })}
        </SizableText>
        <Tabs.TabBar
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

        {isLoading && assets.length === 0 ? (
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
            {assets.map((asset, index) => {
              const { name, logoURI, symbol, badges = [], protocols } = asset;

              return (
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
                      <AprText asset={asset} />
                    </XStack>
                  </XStack>
                </ListItem>
              );
            })}
          </YStack>
        )}
      </YStack>
    );
  }
  return null;
}

export function AvailableAssetsTabViewListMobile({
  onTokenPress,
  assetType,
  faqList,
}: IAvailableAssetsTabViewListProps & {
  assetType: EAvailableAssetsTypeEnum;
  faqList?: Array<{ question: string; answer: string }>;
}) {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ availableAssetsByType = {}, refreshTrigger = 0 }] = useEarnAtom();
  const actions = useEarnActions();
  const media = useMedia();

  // Get filtered assets based on selected tab
  const assets = useMemo(() => {
    return availableAssetsByType[assetType] || [];
  }, [assetType, availableAssetsByType]);

  // Throttled function to fetch assets data
  const fetchAssetsData = useThrottledCallback(
    async (tabType: EAvailableAssetsTypeEnum) => {
      const loadingKey = `availableAssets-${tabType}`;
      actions.current.setLoadingState(loadingKey, true);

      try {
        const tabAssets =
          await backgroundApiProxy.serviceStaking.getAvailableAssets({
            type: tabType,
          });

        // Update the corresponding data in atom
        actions.current.updateAvailableAssetsByType(tabType, tabAssets);
        return tabAssets;
      } finally {
        actions.current.setLoadingState(loadingKey, false);
      }
    },
    200,
    { leading: true, trailing: false },
  );

  // Load data for the selected tab
  const { isLoading } = usePromiseResult(
    async () => {
      if (assetType) {
        const result = await fetchAssetsData(assetType);
        return result || [];
      }
      return [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTrigger, fetchAssetsData],
    {
      watchLoading: true,
    },
  );

  if (assets.length || isLoading) {
    return (
      <YStack>
        <YStack gap="$3" mt="$2">
          {isLoading && assets.length === 0 ? (
            <YStack mx="$5">
              <AvailableAssetsSkeleton />
            </YStack>
          ) : (
            <YStack
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
              {assets.map((asset, index) => {
                const { name, logoURI, symbol, badges = [], protocols } = asset;

                return (
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
                          <SizableText size="$bodyLgMedium">
                            {symbol}
                          </SizableText>
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
                        <AprText asset={asset} />
                      </XStack>
                    </XStack>
                  </ListItem>
                );
              })}
            </YStack>
          )}
        </YStack>
        {faqList?.length ? (
          <YStack py="$4" px="$5">
            <FAQPanel faqList={faqList} isLoading={false} />
          </YStack>
        ) : null}
      </YStack>
    );
  }
  return null;
}
