import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import {
  ETabDiscoveryRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useAppRoute } from '../../hooks/useAppRoute';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useEarnActions } from '../../states/jotai/contexts/earn';

import { BannerV2 } from './components/BannerV2';
import { EarnBlockedOverview } from './components/EarnBlockedOverview';
import { EarnMainTabs } from './components/EarnMainTabs';
import { EarnPageContainer } from './components/EarnPageContainer';
import { Overview } from './components/Overview';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';
import { useBannerInfo } from './hooks/useBannerInfo';
import { useBlockRegion } from './hooks/useBlockRegion';
import { useEarnPortfolio } from './hooks/useEarnPortfolio';
import { useFAQListInfo } from './hooks/useFAQListInfo';

import type { LayoutChangeEvent } from 'react-native';

function BasicEarnHome({
  showHeader,
  showContent,
  overrideDefaultTab,
}: {
  showHeader?: boolean;
  showContent?: boolean;
  overrideDefaultTab?: 'assets' | 'portfolio' | 'faqs';
}) {
  const route = useAppRoute<ITabEarnParamList, ETabEarnRoutes.EarnHome>();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const media = useMedia();
  const actions = useEarnActions();

  const { isFetchingBlockResult, refreshBlockResult, blockResult } =
    useBlockRegion();

  const { earnBanners, refetchBanners } = useBannerInfo();
  const { faqList, isFaqLoading, refetchFAQ } = useFAQListInfo();
  const portfolioData = useEarnPortfolio();
  const { refresh: refreshEarnDataRaw, isLoading: portfolioLoading } =
    portfolioData;
  const refreshEarnData = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearAvailableAssetsCache();
    actions.current.triggerRefresh();
    await refreshEarnDataRaw();
  }, [actions, refreshEarnDataRaw]);

  const navigation = useAppNavigation();

  // Get tab from route params or override (for Discovery tab embedding)
  const defaultTab = overrideDefaultTab || route.params?.tab;

  // Handle tab change - update route params
  const handleTabChange = useCallback(
    (tab: 'assets' | 'portfolio' | 'faqs') => {
      navigation.navigate(ETabEarnRoutes.EarnHome, { tab });
    },
    [navigation],
  );

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
    () => (
      <Stack px="$5">
        <BannerV2 data={earnBanners} onBannerPress={onBannerPress} />
      </Stack>
    ),
    [earnBanners, onBannerPress],
  );

  const isLoading = !!portfolioLoading;
  const intl = useIntl();

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
        showHeader={showHeader}
        showContent={showContent}
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
      <>
        {showHeader && showContent ? <Stack h={tabPageHeight} /> : null}
        <EarnMainTabs
          isMobile
          faqList={faqList || []}
          isFaqLoading={isFaqLoading}
          isAccountsLoading={isLoading}
          refreshEarnAccounts={refreshEarnData}
          defaultTab={defaultTab}
          onTabChange={handleTabChange}
          portfolioData={portfolioData}
          containerProps={{
            contentContainerStyle: {
              display: showContent ? undefined : 'none',
            },
            // eslint-disable-next-line spellcheck/spell-checker
            allowHeaderOverscroll: true,
            renderHeader: () => (
              <YStack gap="$4" pt="$6" bg="$bgApp" pointerEvents="box-none">
                <YStack gap="$7.5">
                  <YStack px="$5">
                    <Overview
                      onRefresh={refreshEarnData}
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
        {showHeader && showContent && platformEnv.isNative ? (
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
      </>
    );
  }

  return (
    <EarnPageContainer
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refreshEarnData} />
      }
    >
      <YStack flex={1} gap="$4">
        {/* overview and banner */}
        <YStack gap="$8">
          <XStack px="$5">
            <Overview onRefresh={refreshEarnData} isLoading={isLoading} />
          </XStack>
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
        <EarnMainTabs
          isMobile={false}
          faqList={faqList || []}
          isFaqLoading={isFaqLoading}
          isAccountsLoading={isLoading}
          defaultTab={defaultTab}
          onTabChange={handleTabChange}
          portfolioData={portfolioData}
          refreshEarnAccounts={refreshEarnData}
        />
      </YStack>
    </EarnPageContainer>
  );
}

export function EarnHomeWithProvider({
  showHeader = true,
  showContent = true,
  defaultTab,
}: {
  showHeader?: boolean;
  showContent?: boolean;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BasicEarnHome
          showHeader={showHeader}
          showContent={showContent}
          overrideDefaultTab={defaultTab}
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

const useNavigateToNativeEarnPage = platformEnv.isNative
  ? () => {
      const { md } = useMedia();
      const navigation = useAppNavigation();
      const route = useAppRoute<ITabEarnParamList, ETabEarnRoutes.EarnHome>();
      const tabParam = route.params?.tab;

      useLayoutEffect(() => {
        if (md) {
          navigation.navigate(
            ETabRoutes.Discovery,
            {
              screen: ETabDiscoveryRoutes.TabDiscovery,
              params: {
                defaultTab: ETranslations.global_earn,
                earnTab: tabParam, // Pass the tab parameter
              },
            },
            {
              pop: true,
            },
          );
        }
      }, [navigation, md, tabParam]);
    }
  : () => {};

export default function EarnHome() {
  useNavigateToNativeEarnPage();
  return platformEnv.isNative ? (
    <Page fullPage>
      <Page.Body>
        <EarnHomeWithProvider />
      </Page.Body>
    </Page>
  ) : (
    <EarnHomeWithProvider />
  );
}
