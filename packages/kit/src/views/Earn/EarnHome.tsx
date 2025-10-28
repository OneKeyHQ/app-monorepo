import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IKeyOfIcons,
  ISizableTextProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Badge,
  Button,
  Empty,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  Popover,
  RefreshControl,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
// import { getPrimaryColor } from '@onekeyhq/shared/src/modules3rdParty/react-native-image-colors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';
import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useEarnActions, useEarnAtom } from '../../states/jotai/contexts/earn';

import { AprText } from './components/AprText';
import {
  AvailableAssetsTabViewList,
  AvailableAssetsTabViewListMobile,
} from './components/AvailableAssetsTabViewList';
import { BannerV2 } from './components/BannerV2';
import { FAQPanel } from './components/FAQPanel';
import { showProtocolListDialog } from './components/showProtocolListDialog';
import { EARN_PAGE_MAX_WIDTH } from './EarnConfig';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';

import type { LayoutChangeEvent } from 'react-native';

const useAllNetworkId = () => useMemo(() => getNetworkIdsMap().onekeyall, []);
const getNumberColor = (
  value: string | number,
  defaultColor: ISizableTextProps['color'] = '$textSuccess',
): ISizableTextProps['color'] =>
  (typeof value === 'string' ? Number(value) : value) === 0
    ? '$text'
    : defaultColor;

const toTokenProviderListPage = async (
  navigation: ReturnType<typeof useAppNavigation>,
  {
    networkId,
    accountId,
    indexedAccountId,
    symbol,
    protocols,
  }: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  },
) => {
  defaultLogger.staking.page.selectAsset({ tokenSymbol: symbol });
  const earnAccount = await backgroundApiProxy.serviceStaking.getEarnAccount({
    accountId,
    indexedAccountId,
    networkId,
  });

  if (protocols.length === 1) {
    const protocol = protocols[0];
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ProtocolDetailsV2,
      params: {
        networkId: protocol.networkId,
        accountId: earnAccount?.accountId || accountId,
        indexedAccountId:
          earnAccount?.account.indexedAccountId || indexedAccountId,
        symbol,
        provider: protocol.provider,
        vault: protocol.vault,
      },
    });
    return;
  }

  // Show dialog for multiple protocols instead of navigating to modal
  showProtocolListDialog({
    symbol,
    accountId: earnAccount?.accountId || accountId,
    indexedAccountId: earnAccount?.account.indexedAccountId || indexedAccountId,
    onProtocolSelect: async (params) => {
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ProtocolDetailsV2,
        params,
      });
    },
  });
};

function RecommendedSkeletonItem({ ...rest }: IYStackProps) {
  return (
    <YStack
      gap="$4"
      px="$5"
      py="$3.5"
      borderRadius="$3"
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
      alignItems="flex-start"
      {...rest}
    >
      <YStack alignItems="flex-start" gap="$4">
        <XStack gap="$3" ai="center" width="100%">
          <Skeleton width="$8" height="$8" radius="round" />
          <YStack py="$1">
            <Skeleton w={56} h={24} borderRadius="$2" />
          </YStack>
        </XStack>
        <Skeleton w={118} h={28} borderRadius="$2" pt="$4" pb="$1" />
      </YStack>
    </YStack>
  );
}

function RecommendedItem({
  token,
  ...rest
}: { token?: IRecommendAsset } & IYStackProps) {
  const accountInfo = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, indexedAccount },
  } = accountInfo;

  const noWalletConnected = useMemo(
    () => !account && !indexedAccount,
    [account, indexedAccount],
  );

  const onPress = useCallback(async () => {
    if (token) {
      const earnAccount =
        await backgroundApiProxy.serviceStaking.getEarnAccount({
          indexedAccountId: indexedAccount?.id,
          accountId: account?.id ?? '',
          networkId: token.protocols[0]?.networkId,
        });
      await toTokenProviderListPage(navigation, {
        indexedAccountId:
          earnAccount?.account.indexedAccountId || indexedAccount?.id,
        accountId: earnAccount?.accountId || account?.id || '',
        networkId: token.protocols[0]?.networkId,
        symbol: token.symbol,
        protocols: token.protocols,
      });
    }
  }, [account?.id, indexedAccount?.id, navigation, token]);

  if (!token) {
    return <YStack width="$40" flexGrow={1} />;
  }

  return (
    <YStack
      role="button"
      flex={1}
      p="$4"
      borderRadius="$3"
      borderCurve="continuous"
      bg={token.bgColor}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      animation="quick"
      hoverStyle={{
        scale: 1.05,
      }}
      pressStyle={{
        scale: 0.95,
      }}
      onPress={onPress}
      userSelect="none"
      alignItems="flex-start"
      overflow="hidden"
      {...rest}
    >
      <YStack alignItems="flex-start" width="100%">
        <XStack gap="$2" ai="center" width="100%">
          <YStack>
            <Image
              size="$6"
              source={{ uri: token.logoURI }}
              fallback={
                <Image.Fallback
                  w="$6"
                  h="$6"
                  alignItems="center"
                  justifyContent="center"
                  bg="$bgStrong"
                >
                  <Icon size="$6" name="CoinOutline" color="$iconDisabled" />
                </Image.Fallback>
              }
            />
          </YStack>
          <SizableText size="$bodyLgMedium">{token.symbol}</SizableText>
        </XStack>
        <YStack alignItems="flex-start" width="100%">
          <SizableText size="$headingXl" pt="$3.5">
            <AprText
              asset={{
                aprWithoutFee: token?.aprWithoutFee ?? '',
                aprInfo: token?.aprInfo,
              }}
            />
          </SizableText>
          {!noWalletConnected ? (
            <SizableText
              pt="$1"
              size="$bodyMd"
              color={token.available.color ?? '$textSubdued'}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {token?.available?.text}
            </SizableText>
          ) : null}
        </YStack>
      </YStack>
    </YStack>
  );
}

function RecommendedContainer({ children }: PropsWithChildren) {
  const intl = useIntl();
  return (
    <YStack
      gap="$3"
      px="$5"
      $md={
        platformEnv.isNative
          ? {
              mx: -20,
            }
          : undefined
      }
    >
      {/* since the children have been used negative margin, so we should use zIndex to make sure the trigger of popover is on top of the children */}
      <YStack
        gap="$1"
        pointerEvents="box-none"
        zIndex={10}
        $md={
          platformEnv.isNative
            ? {
                px: '$5',
              }
            : undefined
        }
      >
        <SizableText size="$headingLg" pointerEvents="box-none">
          {intl.formatMessage({ id: ETranslations.market_trending })}
        </SizableText>
      </YStack>
      {children}
    </YStack>
  );
}

function Recommended() {
  const { md } = useMedia();
  const allNetworkId = useAllNetworkId();
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ refreshTrigger = 0 }] = useEarnAtom();

  const { result: tokens } = usePromiseResult(
    async () => {
      const recommendedAssets =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });
      return recommendedAssets?.tokens || [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      account?.id,
      allNetworkId,
      account?.indexedAccountId,
      indexedAccount?.id,
      refreshTrigger,
    ],
    {
      watchLoading: true,
      initResult: [],
    },
  );

  // Render skeleton when loading and no data
  const shouldShowSkeleton = tokens.length === 0;
  if (shouldShowSkeleton) {
    return (
      <RecommendedContainer>
        {/* Desktop/Extension with larger screen: 4 items per row */}
        {platformEnv.isNative ? (
          // Mobile: horizontal scrolling skeleton
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
            }}
          >
            <XStack gap="$3">
              {Array.from({ length: 4 }).map((_, index) => (
                <YStack key={index} width="$40">
                  <RecommendedSkeletonItem />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        ) : (
          // Desktop/Extension: grid layout
          <XStack m="$-5" p="$3.5" flexWrap="wrap">
            {Array.from({ length: 4 }).map((_, index) => (
              <YStack
                key={index}
                p="$1.5"
                flexBasis={
                  md
                    ? '50%' // Extension small screen: 2 per row
                    : '25%' // Desktop: 4 per row
                }
              >
                <RecommendedSkeletonItem />
              </YStack>
            ))}
          </XStack>
        )}
      </RecommendedContainer>
    );
  }

  // Render actual tokens
  if (tokens.length) {
    return (
      <RecommendedContainer>
        {platformEnv.isNative ? (
          // Mobile: horizontal scrolling
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
            }}
          >
            <XStack gap="$3">
              {tokens.map((token) => (
                <YStack key={token.symbol} minWidth="$52">
                  <RecommendedItem token={token} />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        ) : (
          // Desktop/Extension: grid layout
          <XStack m="$-5" p="$3.5" flexWrap="wrap">
            {tokens.map((token) => (
              <YStack
                key={token.symbol}
                p="$1.5"
                flexBasis={
                  md
                    ? '50%' // Extension small screen: 2 per row
                    : '25%' // Desktop: 4 per row
                }
              >
                <RecommendedItem token={token} />
              </YStack>
            ))}
          </XStack>
        )}
      </RecommendedContainer>
    );
  }
  return null;
}

function Overview({
  isLoading,
  onRefresh,
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const actions = useEarnActions();
  const allNetworkId = useAllNetworkId();
  const totalFiatMapKey = useMemo(
    () =>
      actions.current.buildEarnAccountsKey({
        accountId: account?.id,
        indexAccountId: indexedAccount?.id,
        networkId: allNetworkId,
      }),
    [account?.id, actions, allNetworkId, indexedAccount?.id],
  );
  const [{ earnAccount }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const totalFiatValue = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.totalFiatValue || '0',
    [earnAccount, totalFiatMapKey],
  );
  const earnings24h = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.earnings24h || '0',
    [earnAccount, totalFiatMapKey],
  );
  const hasClaimableAssets = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.hasClaimableAssets || false,
    [earnAccount, totalFiatMapKey],
  );
  const isOverviewLoaded = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.isOverviewLoaded || false,
    [earnAccount, totalFiatMapKey],
  );
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.InvestmentDetails,
    });
  }, [navigation]);
  const intl = useIntl();

  const handleRefresh = useCallback(() => {
    onRefresh();
    void backgroundApiProxy.serviceStaking.clearAvailableAssetsCache();
    actions.current.triggerRefresh();
  }, [onRefresh, actions]);

  return (
    <YStack
      gap="$1"
      px="$5"
      $gtLg={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        flex: 1,
        gap: '$8',
      }}
    >
      {/* total value */}
      <YStack gap="$1.5" flexShrink={1}>
        <SizableText
          size="$bodyLgMedium"
          $gtLg={{
            pl: '$0.5',
          }}
          pointerEvents="box-none"
        >
          {intl.formatMessage({ id: ETranslations.earn_total_staked_value })}
        </SizableText>
        <XStack gap="$3" ai="center">
          <NumberSizeableText
            size="$heading5xl"
            formatter="price"
            color={getNumberColor(totalFiatValue, '$text')}
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            numberOfLines={1}
            pointerEvents="box-none"
          >
            {totalFiatValue}
          </NumberSizeableText>
          {platformEnv.isNative ? null : (
            <IconButton
              icon="RefreshCcwOutline"
              variant="tertiary"
              loading={isLoading}
              onPress={handleRefresh}
            />
          )}
        </XStack>
      </YStack>
      {/* 24h earnings */}
      <XStack
        gap="$1.5"
        paddingRight="$24"
        flexShrink={1}
        $gtLg={{
          flexDirection: 'column-reverse',
        }}
      >
        <NumberSizeableText
          formatter="price"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
            showPlusMinusSigns: Number(earnings24h) !== 0,
          }}
          size="$bodyLgMedium"
          color={getNumberColor(earnings24h)}
          numberOfLines={1}
          $gtLg={{
            size: '$heading5xl',
          }}
          pointerEvents="box-none"
        >
          {earnings24h}
        </NumberSizeableText>
        <XStack gap="$1.5" alignItems="center">
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            $gtLg={{
              pl: '$0.5',
              color: '$text',
              size: '$bodyLgMedium',
            }}
            pointerEvents="box-none"
          >
            {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
          </SizableText>
          <Popover
            placement="bottom-start"
            renderTrigger={
              <IconButton
                variant="tertiary"
                size="small"
                icon="InfoCircleOutline"
              />
            }
            title={intl.formatMessage({
              id: ETranslations.earn_24h_earnings,
            })}
            renderContent={
              <SizableText px="$5" py="$4">
                {intl.formatMessage({
                  id: ETranslations.earn_24h_earnings_tooltip,
                })}
              </SizableText>
            }
          />
        </XStack>
      </XStack>

      {/* details button */}
      {!isOverviewLoaded ? null : (
        <Button
          childrenAsText={!hasClaimableAssets}
          onPress={onPress}
          variant="tertiary"
          iconAfter="ChevronRightOutline"
          position="absolute"
          jc="center"
          top={0}
          right="$4"
          $gtLg={{
            right: '$8',
            top: '$8',
          }}
        >
          {hasClaimableAssets ? (
            <Badge badgeType="info" badgeSize="sm" userSelect="none">
              <Badge.Text>
                {intl.formatMessage({ id: ETranslations.earn_claimable })}
              </Badge.Text>
            </Badge>
          ) : (
            intl.formatMessage({ id: ETranslations.global_details })
          )}
        </Button>
      )}
    </YStack>
  );
}

function EarnBlockedOverview(props: {
  icon: IKeyOfIcons;
  title: string;
  description: string;
  refresh: () => Promise<void>;
  refreshing: boolean;
}) {
  const intl = useIntl();
  const { title, description, icon, refresh, refreshing } = props;

  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
      />
      <Page.Body>
        <Empty
          icon={icon}
          title={title}
          description={description}
          button={
            <Button
              mt="$6"
              size="medium"
              variant="primary"
              onPress={refresh}
              loading={refreshing}
            >
              {intl.formatMessage({
                id: ETranslations.global_refresh,
              })}
            </Button>
          }
        />
      </Page.Body>
    </Page>
  );
}

const renderEarnTabBar = (props: any, containerStyle?: any) => (
  <Tabs.TabBar {...props} containerStyle={containerStyle} />
);

const PortfolioTabContent = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.InvestmentDetails,
    });
  }, [navigation]);

  return (
    <YStack gap="$4" py="$4">
      <YStack
        gap="$4"
        p="$5"
        borderRadius="$3"
        bg="$bg"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderCurve="continuous"
        alignItems="center"
      >
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {intl.formatMessage({ id: ETranslations.earn_portfolio_details })}
        </SizableText>
        <Button onPress={onPress} variant="primary">
          {intl.formatMessage({ id: ETranslations.global_details })}
        </Button>
      </YStack>
    </YStack>
  );
};

function ProtocolsTabContentMobile({
  assetTabData,
  handleTokenPress,
}: {
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
  handleTokenPress: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  }) => Promise<void>;
}) {
  return (
    <>
      <YStack px="$5" pt="$6" gap="$8">
        <Recommended />
      </YStack>
      <Tabs.Container
        renderTabBar={(subProps) =>
          renderEarnTabBar(subProps, { px: '$5', pt: '$4' })
        }
      >
        {assetTabData.map((item) => (
          <Tabs.Tab name={item.title} key={item.type}>
            <Tabs.ScrollView>
              <AvailableAssetsTabViewListMobile
                onTokenPress={handleTokenPress}
                assetType={item.type}
              />
            </Tabs.ScrollView>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    </>
  );
}

// Protocols Tab Content for Desktop
function ProtocolsTabContentDesktop({
  handleTokenPress,
}: {
  handleTokenPress: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  }) => Promise<void>;
}) {
  return (
    <YStack pt="$6" gap="$8">
      <Recommended />
      <AvailableAssetsTabViewList onTokenPress={handleTokenPress} />
    </YStack>
  );
}

function EarnMainTabs({
  isMobile,
  assetTabData,
  handleTokenPress,
  faqList,
  isFaqLoading = false,
  isLoading,
  refreshOverViewData,
  containerProps,
}: {
  isMobile: boolean;
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
  handleTokenPress: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    protocols: IEarnAvailableAssetProtocol[];
  }) => Promise<void>;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  isLoading?: boolean;
  refreshOverViewData?: () => void;
  containerProps?: any;
}) {
  const intl = useIntl();

  const refreshControl =
    isMobile && refreshOverViewData && isLoading !== undefined ? (
      <RefreshControl refreshing={isLoading} onRefresh={refreshOverViewData} />
    ) : undefined;

  const WrapperComponent = isMobile ? Tabs.ScrollView : YStack;
  const wrapperProps = isMobile
    ? { refreshControl }
    : { pt: '$6' as const, gap: '$8' as const };

  return (
    <Tabs.Container
      renderTabBar={(props) => renderEarnTabBar(props)}
      {...containerProps}
    >
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.earn_available_assets,
        })}
      >
        {isMobile ? (
          <Tabs.ScrollView refreshControl={refreshControl}>
            <ProtocolsTabContentMobile
              assetTabData={assetTabData}
              handleTokenPress={handleTokenPress}
            />
          </Tabs.ScrollView>
        ) : (
          <ProtocolsTabContentDesktop handleTokenPress={handleTokenPress} />
        )}
      </Tabs.Tab>
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.earn_portfolio,
        })}
      >
        <WrapperComponent {...wrapperProps}>
          <YStack px="$5">
            <PortfolioTabContent />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
      <Tabs.Tab name={intl.formatMessage({ id: ETranslations.global_faqs })}>
        <WrapperComponent {...wrapperProps}>
          <YStack px="$5">
            <FAQPanel faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
    </Tabs.Container>
  );
}

function BasicEarnHome() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const media = useMedia();
  const actions = useEarnActions();
  const allNetworkId = useAllNetworkId();

  const {
    isLoading: isFetchingBlockResult,
    run: refreshBlockResult,
    result: blockResult,
  } = usePromiseResult(
    async () => {
      const blockData =
        await backgroundApiProxy.serviceStaking.getBlockRegion();
      return { blockData };
    },
    [],
    {
      revalidateOnFocus: true,
    },
  );

  const { isLoading: isFetchingAccounts, run: refreshOverViewData } =
    usePromiseResult(
      async () => {
        if (!account && !indexedAccount) {
          return;
        }
        const totalFiatMapKey = actions.current.buildEarnAccountsKey({
          accountId: account?.id,
          indexAccountId: indexedAccount?.id,
          networkId: allNetworkId,
        });

        const fetchAndUpdateOverview = async () => {
          if (!account && !indexedAccount) {
            return;
          }

          const overviewData =
            await backgroundApiProxy.serviceStaking.fetchAccountOverview({
              accountId: account?.id ?? '',
              networkId: allNetworkId,
              indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
            });
          const earnAccountData =
            actions.current.getEarnAccount(totalFiatMapKey);
          actions.current.updateEarnAccounts({
            key: totalFiatMapKey,
            earnAccount: {
              accounts: earnAccountData?.accounts || [],
              ...overviewData,
              isOverviewLoaded: true,
            },
          });
        };

        const earnAccountData = actions.current.getEarnAccount(totalFiatMapKey);
        if (earnAccountData) {
          await timerUtils.wait(350);
          await fetchAndUpdateOverview();
        } else {
          await fetchAndUpdateOverview();
        }
        return { loaded: true };
      },
      [actions, account, allNetworkId, indexedAccount],
      {
        watchLoading: true,
        pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
        revalidateOnReconnect: true,
        alwaysSetState: true,
      },
    );

  const { result: earnBanners, run: refetchBanners } = usePromiseResult(
    async () => {
      const bannerResult =
        await backgroundApiProxy.serviceStaking.fetchEarnHomePageData();
      return (
        bannerResult?.map((i) => ({
          ...i,
          imgUrl: i.src,
          title: i.title || '',
          titleTextProps: {
            size: '$headingMd',
          },
        })) || []
      );
    },
    [],
    {
      revalidateOnReconnect: true,
      revalidateOnFocus: true,
    },
  );

  const {
    result: faqList,
    isLoading: isFaqLoading,
    run: refetchFAQ,
  } = usePromiseResult(
    async () => {
      const result =
        await backgroundApiProxy.serviceStaking.getFAQListForHome();
      return result;
    },
    [],
    {
      initResult: [],
      watchLoading: true,
      revalidateOnFocus: true,
    },
  );

  const navigation = useAppNavigation();

  const accountSelectorActions = useAccountSelectorActions();

  // Listen to tab focus state and refetch incomplete data
  useListenTabFocusState(
    ETabRoutes.Earn,
    useCallback(
      (isFocus, isHideByModal) => {
        if (isFocus && !isHideByModal) {
          // Check and refetch incomplete data when tab becomes focused
          const allKey = `availableAssets-${EAvailableAssetsTypeEnum.All}`;
          const stableKey = `availableAssets-${EAvailableAssetsTypeEnum.StableCoins}`;
          const nativeKey = `availableAssets-${EAvailableAssetsTypeEnum.NativeTokens}`;

          // Check loading states and data for each key
          const keys = [allKey, stableKey, nativeKey];

          // Check if any data is incomplete and trigger refresh
          const hasIncompleteData = keys.some((key) =>
            actions.current.isDataIncomplete(key),
          );

          if (hasIncompleteData) {
            // Clear loading states and trigger refresh to restart data fetching
            keys.forEach((key) => {
              actions.current.setLoadingState(key, false);
            });
            actions.current.triggerRefresh();
          }

          // Always refetch banner and FAQ data when tab becomes focused
          // since they are not managed by atom loading states
          void refetchBanners();
          void refetchFAQ();
        }
      },
      [actions, refetchBanners, refetchFAQ],
    ),
  );

  // Create adapter function for AvailableAssetsTabViewList
  const handleTokenPress = useCallback(
    async (params: {
      networkId: string;
      accountId: string;
      indexedAccountId?: string;
      symbol: string;
      protocols: IEarnAvailableAssetProtocol[];
    }) => {
      await toTokenProviderListPage(navigation, params);
    },
    [navigation],
  );

  const onBannerPress = useCallback(
    async ({ hrefType, href }: IDiscoveryBanner) => {
      if (account || indexedAccount) {
        if (href.includes('/defi/staking')) {
          const [path, query] = href.split('?');
          const paths = path.split('/');
          const provider = paths.pop();
          const symbol = paths.pop();
          const params = new URLSearchParams(query);
          const networkId = params.get('networkId');
          const vault = params.get('vault');
          if (provider && symbol && networkId) {
            const earnAccount =
              await backgroundApiProxy.serviceStaking.getEarnAccount({
                indexedAccountId: indexedAccount?.id,
                accountId: account?.id ?? '',
                networkId,
              });
            const navigationParams: {
              accountId?: string;
              networkId: string;
              indexedAccountId?: string;
              symbol: string;
              provider: string;
              vault?: string;
            } = {
              accountId: earnAccount?.accountId || account?.id || '',
              indexedAccountId:
                earnAccount?.account.indexedAccountId || indexedAccount?.id,
              provider,
              symbol,
              networkId,
            };
            if (vault) {
              navigationParams.vault = vault;
            }
            void EarnNavigation.pushDetailPageFromDeeplink(
              navigation,
              navigationParams,
            );
          }
          return;
        }
        if (hrefType === 'external') {
          openUrlExternal(href);
        } else {
          openUrlInApp(href);
        }
      } else {
        await accountSelectorActions.current.showAccountSelector({
          navigation,
          activeWallet: undefined,
          num: 0,
          sceneName: EAccountSelectorSceneName.home,
        });
      }
    },
    [account, accountSelectorActions, indexedAccount, navigation],
  );

  const banners = useMemo(
    () => <BannerV2 data={earnBanners} onBannerPress={onBannerPress} />,
    [earnBanners, onBannerPress],
  );

  const isLoading = !!isFetchingAccounts;
  const intl = useIntl();

  const assetTabData = useMemo(
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

  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 143 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // Use the actual measured height without arbitrary adjustments
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);

  if (!isFetchingBlockResult && blockResult?.blockData) {
    return (
      <EarnBlockedOverview
        refresh={refreshBlockResult}
        refreshing={!!isFetchingBlockResult}
        icon={blockResult.blockData.icon.icon}
        title={blockResult.blockData.title.text}
        description={blockResult.blockData.description.text}
      />
    );
  }

  if (platformEnv.isNative && media.md) {
    return (
      <Page fullPage>
        <Page.Body>
          <Stack h={tabPageHeight} />
          <EarnMainTabs
            isMobile
            assetTabData={assetTabData}
            handleTokenPress={handleTokenPress}
            faqList={faqList || []}
            isFaqLoading={isFaqLoading}
            isLoading={isLoading}
            refreshOverViewData={refreshOverViewData}
            containerProps={{
              // eslint-disable-next-line spellcheck/spell-checker
              allowHeaderOverscroll: true,
              renderHeader: () => (
                <YStack gap="$4" pt="$6" bg="$bgApp" pointerEvents="box-none">
                  <YStack gap="$7.5">
                    <YStack px="$5">
                      <Overview
                        onRefresh={refreshOverViewData}
                        isLoading={isLoading}
                      />
                    </YStack>
                    {banners ? (
                      <YStack
                        minHeight="$36"
                        $md={{
                          minHeight: '$28',
                        }}
                        width="100%"
                      >
                        {banners}
                      </YStack>
                    ) : null}
                  </YStack>
                </YStack>
              ),
            }}
          />
          {platformEnv.isNative ? (
            <YStack
              position="absolute"
              top={-20}
              left={0}
              bg="$bgApp"
              pt="$5"
              width="100%"
              onLayout={handleTabPageLayout}
            >
              <TabPageHeader
                sceneName={EAccountSelectorSceneName.home}
                tabRoute={ETabRoutes.Earn}
              />
            </YStack>
          ) : null}
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page fullPage>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
      >
        {/* {headerRight} */}
      </TabPageHeader>
      <Page.Body>
        <ScrollView
          contentContainerStyle={{ py: '$6' }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshOverViewData}
            />
          }
        >
          {/* container */}
          <YStack
            w="100%"
            maxWidth={EARN_PAGE_MAX_WIDTH}
            mx="auto"
            flexDirection={banners ? 'column' : 'row'}
          >
            <YStack flex={1} gap="$4">
              {/* overview and banner */}
              <YStack gap="$8">
                <YStack
                  $gtLg={{
                    px: '$5',
                  }}
                >
                  <Overview
                    onRefresh={refreshOverViewData}
                    isLoading={isLoading}
                  />
                </YStack>
                {banners ? (
                  <YStack
                    minHeight="$36"
                    $md={{
                      minHeight: '$28',
                    }}
                    borderRadius="$3"
                    width="100%"
                    borderCurve="continuous"
                  >
                    {banners}
                  </YStack>
                ) : null}
              </YStack>
              <YStack pt="$3.5">
                <EarnMainTabs
                  isMobile={false}
                  assetTabData={assetTabData}
                  handleTokenPress={handleTokenPress}
                  faqList={faqList || []}
                  isFaqLoading={isFaqLoading}
                />
              </YStack>
            </YStack>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default function EarnHome() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicEarnHome />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
