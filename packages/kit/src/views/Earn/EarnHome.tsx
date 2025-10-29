import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  ScrollView,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
// import { getPrimaryColor } from '@onekeyhq/shared/src/modules3rdParty/react-native-image-colors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';
import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useEarnActions } from '../../states/jotai/contexts/earn';

import { BannerV2 } from './components/BannerV2';
import { EarnBlockedOverview } from './components/EarnBlockedOverview';
import { EarnMainTabs } from './components/EarnMainTabs';
import { Overview } from './components/Overview';
import { EARN_PAGE_MAX_WIDTH } from './EarnConfig';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';
import { useAllNetworkId } from './hooks/useAllNetworkId';

import type { LayoutChangeEvent } from 'react-native';

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
      await EarnNavigation.toTokenProviderListPage(navigation, params);
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
