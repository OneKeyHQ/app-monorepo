import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Empty,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { TableList } from '@onekeyhq/kit/src/components/ListView/TableList';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { AprText } from '../../components/AprText';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnNavigation } from '../../earnUtils';

import type { RouteProp } from '@react-navigation/core';

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnProtocols>;

enum EProtocolCategory {
  SimpleEarn = 'simpleEarn',
  FixedRate = 'fixedRate',
}

const parseDaysRemaining = (rawDaysRemaining?: string | null) => {
  if (!rawDaysRemaining) {
    return undefined;
  }
  const parsed = Number(rawDaysRemaining);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getProviderDaysRemaining = (item: IStakeProtocolListItem) => {
  return parseDaysRemaining(item.provider.daysRemaining);
};

const getProtocolCategory = (item: IStakeProtocolListItem) => {
  const backendCategory = item.provider.category?.trim();
  if (
    backendCategory === EProtocolCategory.SimpleEarn ||
    backendCategory === EProtocolCategory.FixedRate
  ) {
    return backendCategory;
  }

  return earnUtils.isPendleProvider({
    providerName: item.provider.name,
  })
    ? EProtocolCategory.FixedRate
    : EProtocolCategory.SimpleEarn;
};

function BasicEarnProtocols({ route }: { route: IRouteProps }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const {
    symbol,
    filterNetworkId,
    logoURI: encodedLogoURI,
    defaultCategory: defaultCategoryParam,
  } = route.params || {};

  const logoURI = useMemo(() => {
    try {
      return encodedLogoURI ? decodeURIComponent(encodedLogoURI) : undefined;
    } catch {
      return undefined;
    }
  }, [encodedLogoURI]);

  const media = useMedia();

  const isDesktopLayout = !platformEnv.isNative && media.gtSm;

  const customHeaderLeft = useMemo(
    () => (
      <>
        <Token source={logoURI} size="md" />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol ||
            intl.formatMessage({
              id: ETranslations.earn_symbol_staking_provider,
            })}
        </SizableText>
      </>
    ),
    [intl, symbol, logoURI],
  );

  const [protocolData, setProtocolData] = useState<IStakeProtocolListItem[]>(
    [],
  );
  const [selectedCategory, setSelectedCategory] = useState<EProtocolCategory>(
    (defaultCategoryParam as EProtocolCategory) || EProtocolCategory.SimpleEarn,
  );
  const [isLoading, setIsLoading] = useState(true);
  const accountId = activeAccount.account?.id;
  const accountNetworkId = filterNetworkId ?? activeAccount.network?.id;

  const fetchProtocolData = useCallback(async () => {
    if (!activeAccount.ready) {
      return;
    }
    if (accountId && !accountNetworkId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const data = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId,
        networkId: accountNetworkId,
        filterNetworkId,
      });

      setProtocolData(data);
    } catch (_error) {
      setProtocolData([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    symbol,
    accountId,
    accountNetworkId,
    filterNetworkId,
    activeAccount.ready,
  ]);

  useEffect(() => {
    void fetchProtocolData();
  }, [fetchProtocolData]);

  const protocolCategoryCounts = useMemo(() => {
    let simpleEarnCount = 0;
    let fixedRateCount = 0;
    protocolData.forEach((item) => {
      if (getProtocolCategory(item) === EProtocolCategory.FixedRate) {
        fixedRateCount += 1;
      } else {
        simpleEarnCount += 1;
      }
    });
    return { simpleEarnCount, fixedRateCount };
  }, [protocolData]);

  useEffect(() => {
    // Auto-switch only when the current category has no protocols
    if (
      protocolCategoryCounts.fixedRateCount === 0 &&
      protocolCategoryCounts.simpleEarnCount > 0
    ) {
      setSelectedCategory(EProtocolCategory.SimpleEarn);
      return;
    }
    if (
      protocolCategoryCounts.simpleEarnCount === 0 &&
      protocolCategoryCounts.fixedRateCount > 0
    ) {
      setSelectedCategory(EProtocolCategory.FixedRate);
    }
  }, [
    protocolCategoryCounts.fixedRateCount,
    protocolCategoryCounts.simpleEarnCount,
  ]);

  const handleProtocolPress = useCallback(
    async (protocol: IStakeProtocolListItem) => {
      try {
        defaultLogger.staking.page.selectProvider({
          network: protocol.network.networkId,
          stakeProvider: protocol.provider.name,
        });

        if (
          protocol.aprInfo?.button?.type === 'redeem' &&
          !protocol.aprInfo?.button?.disabled
        ) {
          navigation.pushModal(EModalRoutes.StakingModal, {
            screen: EModalStakingRoutes.ManagePosition,
            params: {
              networkId: protocol.network.networkId,
              symbol,
              provider: protocol.provider.name,
              vault: earnUtils.isVaultBasedProvider({
                providerName: protocol.provider.name,
              })
                ? protocol.provider.vault
                : undefined,
              tab: 'withdraw',
            },
          });
          return;
        }

        await EarnNavigation.pushToEarnProtocolDetails(navigation, {
          networkId: protocol.network.networkId,
          symbol,
          provider: protocol.provider.name,
          vault: earnUtils.isVaultBasedProvider({
            providerName: protocol.provider.name,
          })
            ? protocol.provider.vault
            : undefined,
        });
      } catch (_error) {
        // ignore error
      }
    },
    [symbol, navigation],
  );

  const protocolDisplayData = useMemo(() => {
    const isFixedRate = selectedCategory === EProtocolCategory.FixedRate;
    return protocolData.filter((item) => {
      const category = getProtocolCategory(item);
      return isFixedRate
        ? category === EProtocolCategory.FixedRate
        : category === EProtocolCategory.SimpleEarn;
    });
  }, [protocolData, selectedCategory]);

  const columns: ITableColumn<IStakeProtocolListItem>[] = useMemo(() => {
    const isFixedRateCategory =
      selectedCategory === EProtocolCategory.FixedRate;

    const getMaturityDisplay = (item: IStakeProtocolListItem) => {
      const providerName = normalizeToEarnProvider(item.provider.name);
      const maturityTitle =
        item.provider.maturity || item.provider.vaultName || providerName;
      const detailText = item.provider.description || providerName;

      return {
        detailText,
        maturityTitle,
      };
    };

    return [
      {
        key: 'protocol',
        label: intl.formatMessage({
          id: isFixedRateCategory
            ? ETranslations.defi_protocol_maturity
            : ETranslations.global_protocol,
        }),
        flex: 5,
        sortable: isFixedRateCategory,
        comparator: isFixedRateCategory
          ? (a: IStakeProtocolListItem, b: IStakeProtocolListItem) => {
              const daysA =
                getProviderDaysRemaining(a) ?? Number.POSITIVE_INFINITY;
              const daysB =
                getProviderDaysRemaining(b) ?? Number.POSITIVE_INFINITY;
              return daysA - daysB;
            }
          : undefined,
        render: (item) => {
          const providerName = normalizeToEarnProvider(item.provider.name);
          const { detailText, maturityTitle } = getMaturityDisplay(item);

          return (
            <XStack jc="center" ai="center">
              <Stack mr="$3">
                <Token
                  size="md"
                  borderRadius="$2"
                  tokenImageUri={item.provider.logoURI}
                  showNetworkIcon={!isDesktopLayout}
                  networkId={item.network.networkId}
                />
              </Stack>
              <YStack mr="$2" flex={1} minWidth={0}>
                <XStack ai="center" gap="$2" minWidth={0}>
                  <SizableText size="$bodyLgMedium" flexShrink={0}>
                    {isFixedRateCategory ? maturityTitle : providerName}
                  </SizableText>
                  {!isFixedRateCategory
                    ? item.provider.badges?.map((badge) => (
                        <Badge
                          my="auto"
                          key={badge.tag}
                          badgeType={badge.badgeType}
                          badgeSize="sm"
                          flexShrink={1}
                          minWidth={0}
                        >
                          <Badge.Text>{badge.tag}</Badge.Text>
                        </Badge>
                      ))
                    : null}
                </XStack>
                {isFixedRateCategory ? (
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {detailText}
                  </SizableText>
                ) : (
                  <>
                    {isDesktopLayout && item?.provider?.vaultName ? (
                      <SizableText size="$bodySmMedium" color="$textSubdued">
                        {item.provider.vaultName}
                      </SizableText>
                    ) : null}
                    {!isDesktopLayout && item?.provider?.description ? (
                      <SizableText size="$bodySmMedium" color="$textSubdued">
                        {item.provider.description}
                      </SizableText>
                    ) : null}
                  </>
                )}
              </YStack>
            </XStack>
          );
        },
      },
      {
        key: 'network',
        label: intl.formatMessage({ id: ETranslations.global_network }),
        flex: 1,
        hideInMobile: true,
        align: 'flex-end',
        render: (item) => (
          <NetworkAvatarGroup
            networkIds={[item.network.networkId]}
            size="$5"
            variant="spread"
            maxVisible={3}
          />
        ),
      },
      {
        key: 'tvl',
        label: intl.formatMessage({ id: ETranslations.earn_tvl }),
        flex: 2,
        hideInMobile: true,
        align: 'flex-end',
        sortable: true,
        comparator: (a, b) => {
          const tvlA = parseFloat(a.provider.totalFiatValue || '0');
          const tvlB = parseFloat(b.provider.totalFiatValue || '0');
          return tvlA - tvlB;
        },
        render: (item) => (
          <SizableText size="$bodyLgMedium">
            <EarnText size="$bodyLg" text={item?.tvl} />
          </SizableText>
        ),
      },
      {
        key: 'yield',
        label: intl.formatMessage({ id: ETranslations.defi_apr_apy }),
        flex: 2,
        align: 'flex-end',
        sortable: true,
        comparator: (a, b) => {
          const aprA = parseFloat(a.provider.aprWithoutFee || '0');
          const aprB = parseFloat(b.provider.aprWithoutFee || '0');
          return aprA - aprB;
        },
        render: (item) => {
          if (item.aprInfo?.button?.type === 'redeem') {
            return (
              <SizableText size="$bodyLgMedium" color="$textInfo">
                {item.aprInfo.button.text?.text ||
                  intl.formatMessage({ id: ETranslations.defi_redeemable })}
              </SizableText>
            );
          }
          return (
            <AprText
              asset={{
                aprWithoutFee: item?.provider?.aprWithoutFee ?? '',
                aprInfo: item?.aprInfo,
              }}
            />
          );
        },
      },
    ];
  }, [intl, isDesktopLayout, selectedCategory]);

  const shouldShowCategoryTabs =
    protocolCategoryCounts.simpleEarnCount > 0 &&
    protocolCategoryCounts.fixedRateCount > 0;

  const categoryTabs = useMemo(() => {
    if (!shouldShowCategoryTabs) {
      return null;
    }
    const tabItems = [
      {
        key: EProtocolCategory.SimpleEarn,
        label: intl.formatMessage({ id: ETranslations.defi_simple_earn }),
        count: protocolCategoryCounts.simpleEarnCount,
      },
      {
        key: EProtocolCategory.FixedRate,
        label: intl.formatMessage({ id: ETranslations.defi_fixed_rate }),
        count: protocolCategoryCounts.fixedRateCount,
      },
    ];
    return (
      <XStack px="$pagePadding" pb="$3" gap="$2">
        {tabItems.map((item) => {
          const isActive = selectedCategory === item.key;
          return (
            <XStack
              key={item.key}
              role="button"
              cursor="pointer"
              onPress={() => {
                setSelectedCategory(item.key);
              }}
              borderRadius="$full"
              px="$2.5"
              py="$1.5"
              bg={isActive ? '$bgStrong' : '$bgSubdued'}
              ai="center"
              gap="$1.5"
            >
              <SizableText size="$bodyMd" color="$text">
                {item.label}
              </SizableText>
              <Stack
                minWidth="$4"
                h="$4"
                px="$1"
                borderRadius="$full"
                bg={isActive ? '$bg' : '$bgApp'}
                ai="center"
                jc="center"
              >
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {item.count}
                </SizableText>
              </Stack>
            </XStack>
          );
        })}
      </XStack>
    );
  }, [
    intl,
    shouldShowCategoryTabs,
    protocolCategoryCounts.fixedRateCount,
    protocolCategoryCounts.simpleEarnCount,
    selectedCategory,
  ]);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <YStack>
          {/* Table Header - Desktop only */}
          {isDesktopLayout ? (
            <ListItem mx="$0" px="$pagePadding">
              <XStack flex={2.5}>
                <Skeleton h="$3" w={80} />
              </XStack>
              <XStack flex={1} jc="flex-end">
                <Skeleton h="$3" w={60} />
              </XStack>
              <XStack flex={2} jc="flex-end">
                <Skeleton h="$3" w={40} />
              </XStack>
              <XStack flex={2} jc="flex-end">
                <Skeleton h="$3" w={40} />
              </XStack>
            </ListItem>
          ) : null}

          {/* Table Rows */}
          {Array.from({ length: 3 }).map((_, index) => (
            <ListItem
              key={index}
              mx="$0"
              px="$pagePadding"
              ai={isDesktopLayout ? 'center' : 'flex-start'}
            >
              {/* Protocol column */}
              <XStack flex={isDesktopLayout ? 2.5 : 1} ai="center" gap="$3">
                <Skeleton w="$10" h="$10" borderRadius="$2" />
                <YStack gap="$1" flex={1}>
                  <Skeleton h="$4" w="70%" />
                  <Skeleton h="$3" w="50%" />
                </YStack>
              </XStack>

              {isDesktopLayout ? (
                <>
                  {/* Network column */}
                  <XStack flex={1} jc="flex-end">
                    <Skeleton w="$6" h="$6" borderRadius="$full" />
                  </XStack>
                  {/* TVL column */}
                  <XStack flex={2} jc="flex-end">
                    <Skeleton h="$4" w={100} />
                  </XStack>
                  {/* APR column */}
                  <XStack flex={2} jc="flex-end">
                    <Skeleton h="$4" w={80} />
                  </XStack>
                </>
              ) : (
                <YStack ai="flex-end">
                  <Skeleton h="$4" w={80} />
                </YStack>
              )}
            </ListItem>
          ))}
        </YStack>
      );
    }

    if (protocolData.length === 0) {
      return (
        <YStack alignItems="center" flex={1}>
          <Empty
            px="$pagePadding"
            py="$0"
            width="100%"
            icon="ErrorOutline"
            title={intl.formatMessage({
              id: ETranslations.earn_no_protocols_available,
            })}
            buttonProps={{
              flex: 1,
              children: intl.formatMessage({
                id: ETranslations.global_refresh,
              }),
              onPress: () => {
                void fetchProtocolData();
              },
            }}
          />
        </YStack>
      );
    }

    return (
      <YStack>
        {categoryTabs}
        <TableList<IStakeProtocolListItem>
          key={selectedCategory}
          data={protocolDisplayData}
          columns={columns}
          defaultSortKey={
            selectedCategory === EProtocolCategory.FixedRate
              ? 'protocol'
              : 'yield'
          }
          defaultSortDirection={
            selectedCategory === EProtocolCategory.FixedRate ? 'asc' : 'desc'
          }
          onPressRow={handleProtocolPress}
          enableDrillIn={isDesktopLayout}
          isLoading={isLoading}
        />
      </YStack>
    );
  }, [
    isLoading,
    protocolData,
    protocolDisplayData,
    categoryTabs,
    columns,
    selectedCategory,
    handleProtocolPress,
    isDesktopLayout,
    intl,
    fetchProtocolData,
  ]);

  const tabBarHeight = useScrollContentTabBarOffset();

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      pageTitle={customHeaderLeft}
      customHeaderRightItems={platformEnv.isNative ? <></> : undefined}
      contentContainerStyle={{
        pb: tabBarHeight,
      }}
      breadcrumbProps={{
        items: [
          {
            label: intl.formatMessage({ id: ETranslations.global_earn }),
            onClick: () => {
              void EarnNavigation.popToEarnHome(navigation);
            },
          },
          {
            label:
              symbol ||
              intl.formatMessage({
                id: ETranslations.earn_symbol_staking_provider,
              }),
          },
        ],
      }}
      showBackButton
      showBodyTitle
    >
      {content}
    </EarnPageContainer>
  );
}

export default function EarnProtocols(props: { route: IRouteProps }) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <DiscoveryBrowserProviderMirror>
        <BasicEarnProtocols {...props} />
      </DiscoveryBrowserProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
