import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useThrottledCallback } from 'use-debounce';

import type { ISizableTextProps, IYStackProps } from '@onekeyhq/components';
import {
  Badge,
  Banner,
  Button,
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
import { getPrimaryColor } from '@onekeyhq/shared/src/modules3rdParty/react-native-image-colors';
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
import type {
  IEarnAvailableAsset,
  IEarnAvailableAssetProtocol,
} from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnRewardUnit } from '@onekeyhq/shared/types/staking';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useEarnActions, useEarnAtom } from '../../states/jotai/contexts/earn';

import { AvailableAssetsTabViewList } from './components/AvailableAssetsTabViewList';
import { FAQPanel } from './components/FAQPanel';
import { showProtocolListDialog } from './components/showProtocolListDialog';
import { EARN_PAGE_MAX_WIDTH, EARN_RIGHT_PANEL_WIDTH } from './EarnConfig';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';

const BANNER_TITLE_OFFSET = {
  desktop: '$5',
  mobile: '$10',
};

const buildAprText = (apr: string, unit: IEarnRewardUnit) => `${apr} ${unit}`;
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
    networkId: protocols[0].networkId,
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
}: { token?: IEarnAvailableAsset } & IYStackProps) {
  const accountInfo = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const [decorationColor, setDecorationColor] = useState<string | null>(null);

  useEffect(() => {
    const url = token?.logoURI;
    if (url) {
      void getPrimaryColor(url, '$bgSubdued').then(setDecorationColor);
    }
  }, [token?.logoURI]);

  const onPress = useCallback(async () => {
    const {
      activeAccount: { account, indexedAccount },
    } = accountInfo;
    if ((account || indexedAccount) && token) {
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
  }, [accountInfo, navigation, token]);

  if (!token) {
    return <YStack width="$40" flexGrow={1} />;
  }

  return (
    <YStack
      role="button"
      flex={1}
      px="$5"
      py="$3.5"
      borderRadius="$3"
      borderCurve="continuous"
      bg={decorationColor}
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
      <YStack alignItems="flex-start">
        <XStack gap="$3" ai="center" width="100%">
          <YStack>
            <Image size="$8">
              <Image.Source
                source={{
                  uri: token.logoURI,
                }}
              />
              <Image.Fallback
                alignItems="center"
                justifyContent="center"
                bg="$bgStrong"
                delayMs={1000}
              >
                <Icon size="$5" name="CoinOutline" color="$iconDisabled" />
              </Image.Fallback>
            </Image>
          </YStack>
          <SizableText size="$bodyLgMedium">{token.symbol}</SizableText>
        </XStack>
        <SizableText size="$headingXl" pt="$4" pb="$1">
          {buildAprText(
            token.aprWithoutFee,
            token.rewardUnit as IEarnRewardUnit,
          )}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function RecommendedContainer({ children }: PropsWithChildren) {
  const intl = useIntl();
  return (
    <YStack
      gap="$3"
      px="$0"
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
        zIndex={10}
        $md={
          platformEnv.isNative
            ? {
                px: '$5',
              }
            : undefined
        }
      >
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.market_trending })}
        </SizableText>
      </YStack>
      {children}
    </YStack>
  );
}

function Recommended() {
  const actions = useEarnActions();
  const { md } = useMedia();
  const [{ availableAssetsByType = {}, refreshTrigger = 0 }] = useEarnAtom();

  // Throttled function to fetch recommended assets
  const fetchRecommendedAssets = useThrottledCallback(
    async () => {
      const recommendedAssets =
        await backgroundApiProxy.serviceStaking.getAvailableAssets({
          type: EAvailableAssetsTypeEnum.Recommend,
        });

      // Update the corresponding data in atom
      actions.current.updateAvailableAssetsByType(
        EAvailableAssetsTypeEnum.Recommend,
        recommendedAssets,
      );
      return recommendedAssets;
    },
    timerUtils.getTimeDurationMs({ seconds: 2 }),
    { leading: true, trailing: false },
  );

  // Get recommended assets
  const { isLoading } = usePromiseResult(
    async () => {
      const result = await fetchRecommendedAssets();
      return result || [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTrigger, fetchRecommendedAssets], // Add refreshTrigger as dependency
    {
      watchLoading: true,
    },
  );

  const tokens = useMemo(() => {
    const recommendAssets =
      availableAssetsByType[EAvailableAssetsTypeEnum.Recommend] || [];
    return recommendAssets;
  }, [availableAssetsByType]);

  // Render skeleton when loading
  if (isLoading || tokens.length < 1) {
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
                  platformEnv.isExtension && !platformEnv.isDesktop
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
                <YStack key={token.symbol} width="$40">
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
        p: '$8',
        bg: '$bg',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
        borderRadius: '$3',
        borderCurve: 'continuous',
        elevation: 0.5,
      }}
    >
      {/* total value */}
      <YStack gap="$1.5" flexShrink={1}>
        <SizableText
          size="$bodyLgMedium"
          $gtLg={{
            pl: '$0.5',
          }}
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

function BasicEarnHome() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const media = useMedia();
  const actions = useEarnActions();
  const allNetworkId = useAllNetworkId();

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

  const { result: earnBanners } = usePromiseResult(
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
    },
  );

  const { result: faqList, isLoading: isFaqLoading } = usePromiseResult(
    async () => backgroundApiProxy.serviceStaking.getFAQListForHome(),
    [],
    {
      initResult: [],
      watchLoading: true,
    },
  );

  const navigation = useAppNavigation();

  const accountSelectorActions = useAccountSelectorActions();

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
    async ({
      hrefType,
      href,
    }: {
      imgUrl: string;
      title: string;
      bannerId: string;
      src: string;
      href: string;
      hrefType: string;
      rank: number;
      useSystemBrowser: boolean;
      theme?: 'light' | 'dark';
    }) => {
      if (account || indexedAccount) {
        if (href.includes('/earn/staking')) {
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
            void EarnNavigation.pushDetailPageFromDeeplink(navigation, {
              accountId: earnAccount?.accountId || account?.id || '',
              indexedAccountId:
                earnAccount?.account.indexedAccountId || indexedAccount?.id,
              provider,
              symbol,
              networkId,
              vault: vault ?? '',
            });
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

  const banners = useMemo(() => {
    if (earnBanners) {
      return earnBanners.length ? (
        <Banner
          height="$36"
          $md={{
            height: '$28',
          }}
          data={earnBanners}
          onItemPress={onBannerPress}
          isLoading={false}
          itemTitleContainerStyle={{
            top: 0,
            bottom: 0,
            right: '$5',
            left: media.gtLg
              ? BANNER_TITLE_OFFSET.desktop
              : BANNER_TITLE_OFFSET.mobile,
            justifyContent: 'center',
          }}
        />
      ) : null;
    }
    return (
      <Skeleton
        height="$36"
        $md={{
          height: '$28',
        }}
        width="100%"
      />
    );
  }, [earnBanners, media.gtLg, onBannerPress]);

  const isLoading = !!isFetchingAccounts;

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
          contentContainerStyle={{ py: '$5' }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshOverViewData}
            />
          }
        >
          {/* container */}
          <YStack w="100%" maxWidth={EARN_PAGE_MAX_WIDTH} mx="auto" gap="$4">
            {/* overview and banner */}
            <YStack
              gap="$8"
              $gtLg={{
                px: '$5',
                flexDirection: 'row',
              }}
            >
              <Overview onRefresh={refreshOverViewData} isLoading={isLoading} />
              <YStack
                px="$5"
                minHeight="$36"
                $md={{
                  minHeight: '$28',
                }}
                borderRadius="$3"
                width="100%"
                borderCurve="continuous"
                $gtLg={{
                  px: '$0',
                  w: EARN_RIGHT_PANEL_WIDTH,
                }}
              >
                {banners}
              </YStack>
            </YStack>
            {/* Recommended, available assets and introduction */}
            <YStack
              px="$5"
              gap="$8"
              $gtLg={{
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <YStack
                pt="$3.5"
                gap="$8"
                $gtLg={{
                  flex: 1,
                }}
              >
                <Recommended />
                <AvailableAssetsTabViewList onTokenPress={handleTokenPress} />
              </YStack>
              {/* FAQ Panel */}
              {media.gtLg && (isFaqLoading || faqList.length > 0) ? (
                <YStack
                  gap="$6"
                  py="$4"
                  px="$5"
                  borderRadius="$3"
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="$borderSubdued"
                  borderCurve="continuous"
                  $gtMd={{
                    w: EARN_RIGHT_PANEL_WIDTH,
                  }}
                >
                  <FAQPanel faqList={faqList} isLoading={isFaqLoading} />
                </YStack>
              ) : null}
            </YStack>
            {media.gtLg || (faqList.length === 0 && !isFaqLoading) ? null : (
              <YStack mt="$1" px="$4" py="$4">
                <FAQPanel faqList={faqList} isLoading={isFaqLoading} />
              </YStack>
            )}
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
