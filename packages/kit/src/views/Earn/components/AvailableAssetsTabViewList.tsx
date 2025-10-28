import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useThrottledCallback } from 'use-debounce';

import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  IconButton,
  ListView,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnAvailableAsset,
  IEarnAvailableAssetProtocol,
} from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { AprText } from './AprText';

const SortButton = ({
  label,
  iconName,
  onPress,
  width,
  ai = 'flex-start',
}: {
  label: string;
  iconName?: IKeyOfIcons;
  onPress?: IXStackProps['onPress'];
  width?: number;
  ai?: 'flex-start' | 'center' | 'flex-end';
}) => {
  return (
    <XStack
      role="button"
      width={width}
      ai="center"
      jc={ai}
      gap="$1"
      cursor="pointer"
      hoverStyle={{ opacity: 0.7 }}
      userSelect="none"
      onPress={onPress}
    >
      {iconName ? (
        <Icon name={iconName} color="$iconSubdued" size="$4.5" />
      ) : null}
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {label}
      </SizableText>
    </XStack>
  );
};

const AvailableAssetsListHeader = ({
  tableLayout,
  sortDirection,
  onSortPress,
}: {
  tableLayout?: boolean;
  sortDirection: 'asc' | 'desc';
  onSortPress?: () => void;
}) => {
  const intl = useIntl();

  const renderSortIcon = (): IKeyOfIcons => {
    return sortDirection === 'desc'
      ? 'ChevronDownSmallOutline'
      : 'ChevronTopSmallOutline';
  };

  if (!tableLayout) {
    return (
      <ListItem>
        <Stack flex={1} ai="flex-start">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_asset })}
          </SizableText>
        </Stack>
        <Stack flexShrink={0} ai="flex-end">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            Yield
          </SizableText>
        </Stack>
      </ListItem>
    );
  }

  return (
    <ListItem gap="$3">
      <Stack flexGrow={1} flexBasis={0} ai="flex-start">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </SizableText>
      </Stack>
      <Stack flexGrow={1} flexBasis={0} ai="flex-start">
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          Network
        </SizableText>
      </Stack>
      <Stack flexGrow={1} flexBasis={0} ai="flex-end">
        <SortButton
          label="Yield"
          iconName={renderSortIcon()}
          onPress={onSortPress}
          ai="flex-end"
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0} />
    </ListItem>
  );
};

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
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSortYield = useCallback(() => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

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

  // Get filtered and sorted assets based on selected tab
  const assets = useMemo(() => {
    const currentTabType = tabData[selectedTabIndex]?.type;
    const assetList = availableAssetsByType[currentTabType] || [];

    return [...assetList].sort(
      (a: IEarnAvailableAsset, b: IEarnAvailableAsset) => {
        const aprA = parseFloat(a.aprWithoutFee || a.apr || '0');
        const aprB = parseFloat(b.aprWithoutFee || b.apr || '0');

        if (sortDirection === 'asc') {
          return aprA - aprB;
        }
        return aprB - aprA;
      },
    );
  }, [availableAssetsByType, selectedTabIndex, tabData, sortDirection]);

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

        {isLoading && assets.length === 0 ? (
          <AvailableAssetsSkeleton />
        ) : (
          <ListView
            extraData={assets.length}
            data={assets}
            ListHeaderComponent={
              media.gtLg ? (
                <AvailableAssetsListHeader
                  tableLayout={media.gtLg}
                  sortDirection={sortDirection}
                  onSortPress={handleSortYield}
                />
              ) : null
            }
            renderItem={({ item: asset }) => {
              const { logoURI, symbol, badges = [], protocols } = asset;

              return media.gtLg ? (
                <ListItem
                  gap="$3"
                  userSelect="none"
                  onPress={async () => {
                    await onTokenPress?.({
                      networkId: protocols[0]?.networkId || '',
                      accountId: account?.id ?? '',
                      indexedAccountId: indexedAccount?.id,
                      symbol,
                      protocols,
                    });
                  }}
                >
                  <XStack flexGrow={1} flexBasis={0} ai="center" gap="$3">
                    <Token
                      size="md"
                      tokenImageUri={logoURI}
                      borderRadius="$full"
                    />
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
                  <YStack flexGrow={1} flexBasis={0} ai="flex-start">
                    <NetworkAvatarGroup
                      networkIds={Array.from(
                        new Set(protocols.map((p) => p.networkId)),
                      )}
                      size="$5"
                      variant="spread"
                      maxVisible={3}
                    />
                  </YStack>
                  <YStack flexGrow={1} flexBasis={0} ai="flex-end">
                    <AprText asset={asset} />
                  </YStack>
                  <Stack flexGrow={1} flexBasis={0} ai="flex-end">
                    <Icon
                      name="ChevronRightSmallOutline"
                      size="$5"
                      color="$iconSubdued"
                    />
                  </Stack>
                </ListItem>
              ) : (
                <ListItem
                  userSelect="none"
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
                  }}
                  // mx="$0"
                  // px="$0"
                >
                  <ListItem.Text
                    flex={1}
                    primary={
                      <XStack gap="$2" ai="center">
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
                  <XStack flex={1} ai="center" jc="flex-end">
                    <XStack flexShrink={0} jc="flex-end">
                      <AprText asset={asset} />
                    </XStack>
                  </XStack>
                </ListItem>
              );
            }}
          />
        )}
      </YStack>
    );
  }
  return null;
}

export function AvailableAssetsTabViewListMobile({
  onTokenPress,
  assetType,
}: IAvailableAssetsTabViewListProps & {
  assetType: EAvailableAssetsTypeEnum;
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
                        <XStack gap="$2" ai="center">
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
                        jc="flex-end"
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
      </YStack>
    );
  }
  return null;
}
