import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { RefreshControl, XStack, YStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type ETabEarnRoutes,
  ETabRoutes,
  type ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { LazyPageContainer } from '../../components/LazyPageContainer';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useAppRoute } from '../../hooks/useAppRoute';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../states/jotai/contexts/accountSelector';
import { useEarnActions } from '../../states/jotai/contexts/earn';
import { BorrowHome } from '../Borrow/pages/BorrowHome';
import { isBorrowTag } from '../Staking/utils/utils';

import { BannerV2 } from './components/BannerV2';
import { EarnBlockedOverview } from './components/EarnBlockedOverview';
import { EarnHomeTabs } from './components/EarnHomeTabs';
import { EarnMainTabs } from './components/EarnMainTabs';
import { EarnPageContainer } from './components/EarnPageContainer';
import { MarketSelector } from './components/MarketSelector';
import { Overview } from './components/Overview';
import { EarnProviderMirror } from './EarnProviderMirror';
import { EarnNavigation } from './earnUtils';
import { useBannerInfo } from './hooks/useBannerInfo';
import { useBlockRegion } from './hooks/useBlockRegion';
import { useEarnHideSmallAssets } from './hooks/useEarnHideSmallAssets';
import { useEarnPortfolio } from './hooks/useEarnPortfolio';
import { useFAQListInfo } from './hooks/useFAQListInfo';
import { useStakingPendingTxsByInfo } from './hooks/useStakingPendingTxs';

import type { IStakePendingTx } from './hooks/useStakingPendingTxs';

const BORROW_PENDING_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});

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
  const actions = useEarnActions();

  const { isFetchingBlockResult, refreshBlockResult, blockResult } =
    useBlockRegion();

  const { earnBanners } = useBannerInfo();
  const { faqList, isFaqLoading, refetchFAQ } = useFAQListInfo();
  const [isEarnTabFocused, setIsEarnTabFocused] = useState(false);
  const wasFocusedRef = useRef(false);
  const portfolioData = useEarnPortfolio({ isActive: isEarnTabFocused });
  const { refresh: refreshEarnDataRaw, isLoading: portfolioLoading } =
    portfolioData;

  const isLoading = useMemo(() => {
    if (platformEnv.isNative && !showContent) {
      return false;
    }
    return portfolioLoading;
  }, [portfolioLoading, showContent]);

  const { hideSmallAssets } = useEarnHideSmallAssets();

  // Calculate filtered total fiat value when hiding small assets
  const filteredTotalFiatValue = useMemo(() => {
    if (!hideSmallAssets) {
      return undefined; // Use default from Overview
    }

    const { investments } = portfolioData;
    const total = investments.reduce((sum, inv) => {
      // Filter assets with fiatValueUsd < 0.01
      const filteredAssetsValue = inv.assets.reduce((assetSum, asset) => {
        const assetValueUsd = Number(asset.metadata?.fiatValueUsd ?? 0);
        if (assetValueUsd >= 0.01) {
          return assetSum.plus(new BigNumber(asset.metadata?.fiatValue ?? 0));
        }
        return assetSum;
      }, new BigNumber(0));
      return sum.plus(filteredAssetsValue);
    }, new BigNumber(0));

    return total.toFixed();
  }, [hideSmallAssets, portfolioData]);

  const pendingTxsFilter = useCallback((tx: IStakePendingTx) => {
    return [EEarnLabels.Stake, EEarnLabels.Withdraw].includes(
      tx.stakingInfo.label,
    );
  }, []);
  const { filteredTxs } = useStakingPendingTxsByInfo({
    filter: pendingTxsFilter,
  });
  const isPending = useMemo(() => {
    return filteredTxs.length > 0;
  }, [filteredTxs]);
  const previousIsPendingRef = useRef(isPending);

  useEffect(() => {
    if (previousIsPendingRef.current && !isPending) {
      void refreshEarnDataRaw();
    }
    previousIsPendingRef.current = isPending;
  }, [isPending, refreshEarnDataRaw]);

  const [borrowNetworkIds, setBorrowNetworkIds] = useState<string[]>([]);
  const borrowRefreshHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const handleRegisterBorrowRefresh = useCallback(
    (handler: (() => Promise<void>) | null) => {
      borrowRefreshHandlerRef.current = handler;
    },
    [],
  );

  const handleBorrowNetworksChange = useCallback((nextNetworkIds: string[]) => {
    setBorrowNetworkIds((prev) => {
      if (
        prev.length === nextNetworkIds.length &&
        prev.every((id, index) => id === nextNetworkIds[index])
      ) {
        return prev;
      }
      return nextNetworkIds;
    });
  }, []);

  const handleBorrowPendingRefresh = useCallback(() => {
    void borrowRefreshHandlerRef.current?.();
  }, []);

  const { filteredTxs: borrowPendingTxs = [] } = useStakingPendingTxsByInfo({
    networkIds: borrowNetworkIds,
    tagMatcher: isBorrowTag,
    onRefresh: handleBorrowPendingRefresh,
    onRefreshDelayMs: BORROW_PENDING_REFRESH_DELAY,
  });
  const prevBorrowPendingIdsRef = useRef<string | null>(null);

  useEffect(() => {
    const nextIds = borrowPendingTxs.map((tx) => tx.id).join(',');
    if (prevBorrowPendingIdsRef.current !== nextIds) {
      prevBorrowPendingIdsRef.current = nextIds;
    }
  }, [borrowPendingTxs]);

  const refreshEarnData = useCallback(async () => {
    await backgroundApiProxy.serviceStaking.clearAvailableAssetsCache();
    actions.current.triggerRefresh();
    await refreshEarnDataRaw();
  }, [actions, refreshEarnDataRaw]);

  const navigation = useAppNavigation();

  const defaultTab = overrideDefaultTab || route.params?.tab;
  const defaultMode = route.params?.mode || 'earn';
  const isEarnMode = defaultMode === 'earn';
  const isBorrowMode = defaultMode === 'borrow';

  const handleModeChange = useCallback(
    (mode: 'earn' | 'borrow') => {
      // Use setParams to update mode without navigation - prevents remount flash
      navigation.setParams({ mode, tab: route.params?.tab });
    },
    [navigation, route.params?.tab],
  );

  useEffect(() => {
    const handleSwitchEarnMode = ({ mode }: { mode: 'earn' | 'borrow' }) => {
      if (mode !== defaultMode) {
        handleModeChange(mode);
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchEarnMode, handleSwitchEarnMode);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchEarnMode, handleSwitchEarnMode);
    };
  }, [defaultMode, handleModeChange]);

  const media = useMedia();

  const accountSelectorActions = useAccountSelectorActions();

  const handleListenTabFocusState = useCallback(
    (isFocus: boolean, isHideByModal: boolean) => {
      const actualFocus = isFocus && !isHideByModal;
      wasFocusedRef.current = actualFocus;
      setIsEarnTabFocused(actualFocus);
      if (!actualFocus) return;

      const allKey = `availableAssets-${EAvailableAssetsTypeEnum.All}`;
      const stableKey = `availableAssets-${EAvailableAssetsTypeEnum.StableCoins}`;
      const nativeKey = `availableAssets-${EAvailableAssetsTypeEnum.NativeTokens}`;

      const keys = [allKey, stableKey, nativeKey];

      const hasIncompleteData = keys.some((key) =>
        actions.current.isDataIncomplete(key),
      );

      if (hasIncompleteData) {
        keys.forEach((key) => {
          actions.current.setLoadingState(key, false);
        });
        actions.current.triggerRefresh();
      }

      void refetchFAQ();
    },
    [actions, refetchFAQ],
  );

  useListenTabFocusState(
    [ETabRoutes.Earn, ETabRoutes.Discovery],
    handleListenTabFocusState,
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
            const navigationParams: {
              networkId: string;
              symbol: string;
              provider: string;
              vault?: string;
            } = {
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
      <BannerV2
        data={earnBanners}
        onBannerPress={onBannerPress}
        isActive={isEarnTabFocused}
      />
    ),
    [earnBanners, onBannerPress, isEarnTabFocused],
  );

  const mobileContainerProps = useMemo(
    () => ({
      contentContainerStyle: {
        display: showContent ? undefined : 'none',
      },
      allowHeaderOverscroll: true,
      renderHeader: () => (
        <YStack gap="$4" pt="$4" bg="$bgApp" pointerEvents="box-none">
          <YStack gap="$7.5">
            <YStack px="$5">
              <Overview
                onRefresh={refreshEarnData}
                isLoading={isLoading}
                filteredTotalFiatValue={filteredTotalFiatValue}
              />
            </YStack>
            {banners ? <YStack width="100%">{banners}</YStack> : null}
          </YStack>
        </YStack>
      ),
    }),
    [showContent, refreshEarnData, isLoading, filteredTotalFiatValue, banners],
  );

  // const [tabPageHeight, setTabPageHeight] = useState(
  //   platformEnv.isNativeIOS ? 143 : 92,
  // );
  // const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
  //   const height = e.nativeEvent.layout.height - 20;
  //   setTabPageHeight(height);
  // }, []);

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

  if (platformEnv.isNative) {
    const marketSelectorHeader = (
      <MarketSelector mode={defaultMode} onModeChange={handleModeChange} />
    );

    return (
      <YStack flex={1}>
        <YStack
          flex={1}
          display={isEarnMode ? 'flex' : 'none'}
          pointerEvents={isEarnMode ? 'auto' : 'none'}
        >
          <EarnMainTabs
            faqList={faqList || []}
            isFaqLoading={isFaqLoading}
            defaultTab={defaultTab}
            portfolioData={portfolioData}
            containerProps={mobileContainerProps}
            header={marketSelectorHeader}
          />

          {showHeader && showContent && media.md ? (
            <YStack
              position="absolute"
              top={-20}
              left={0}
              bg="$bgApp"
              pt="$5"
              width="100%"
              // onLayout={handleTabPageLayout}
            >
              <TabPageHeader
                sceneName={EAccountSelectorSceneName.home}
                tabRoute={ETabRoutes.Earn}
              />
            </YStack>
          ) : null}
        </YStack>
        <YStack
          flex={1}
          display={isBorrowMode ? 'flex' : 'none'}
          pointerEvents={isBorrowMode ? 'auto' : 'none'}
        >
          <BorrowHome
            header={marketSelectorHeader}
            isActive={isBorrowMode}
            pendingTxs={borrowPendingTxs}
            onRegisterBorrowRefresh={handleRegisterBorrowRefresh}
            onBorrowNetworksChange={handleBorrowNetworksChange}
          />
        </YStack>
      </YStack>
    );
  }

  return (
    <LazyPageContainer>
      <EarnPageContainer
        showTabPageHeader={media.gtMd}
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        disableMaxWidth
        contentContainerStyle={{
          py: 0,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshEarnData} />
        }
      >
        <EarnHomeTabs
          defaultMode={defaultMode}
          onModeChange={handleModeChange}
          earn={
            <YStack flex={1}>
              <YStack>
                <XStack px="$5">
                  <Overview
                    onRefresh={refreshEarnData}
                    isLoading={isLoading}
                    filteredTotalFiatValue={filteredTotalFiatValue}
                  />
                </XStack>
                {banners ? (
                  <YStack
                    borderRadius="$3"
                    width="100%"
                    borderCurve="continuous"
                  >
                    {banners}
                  </YStack>
                ) : null}
              </YStack>
              <EarnMainTabs
                faqList={faqList || []}
                isFaqLoading={isFaqLoading}
                defaultTab={defaultTab}
                portfolioData={portfolioData}
              />
            </YStack>
          }
          borrow={
            <BorrowHome
              isActive={isBorrowMode}
              pendingTxs={borrowPendingTxs}
              onRegisterBorrowRefresh={handleRegisterBorrowRefresh}
              onBorrowNetworksChange={handleBorrowNetworksChange}
            />
          }
        />
      </EarnPageContainer>
    </LazyPageContainer>
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

export default function EarnHome() {
  return platformEnv.isNative ? null : <EarnHomeWithProvider />;
}
