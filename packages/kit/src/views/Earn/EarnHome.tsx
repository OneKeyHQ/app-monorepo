import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useSharedValue } from 'react-native-reanimated';

import {
  HeaderScrollGestureWrapper,
  RefreshControl,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type ETabEarnRoutes,
  ETabRoutes,
  type ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { LazyPageContainer } from '../../components/LazyPageContainer';
import { TabPageHeader } from '../../components/TabPageHeader';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useAppRoute } from '../../hooks/useAppRoute';
import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import { useEarnActions } from '../../states/jotai/contexts/earn';
import { BorrowHome } from '../Borrow/pages/BorrowHome';
import { isBorrowTag } from '../Staking/utils/utils';

import { EarnBlockedOverview } from './components/EarnBlockedOverview';
import { EarnBorrowPagerView } from './components/EarnBorrowPagerView';
import { EarnHomeTabs } from './components/EarnHomeTabs';
import { EarnMainTabs } from './components/EarnMainTabs';
import { EarnPageContainer } from './components/EarnPageContainer';
import { MarketSelector } from './components/MarketSelector';
import { Overview } from './components/Overview';
import { getEarnFocusState } from './EarnHome.utils';
import { EarnProviderMirror } from './EarnProviderMirror';
import { useBlockRegion } from './hooks/useBlockRegion';
import { useEarnHideSmallAssets } from './hooks/useEarnHideSmallAssets';
import { useEarnPortfolio } from './hooks/useEarnPortfolio';
import { useFAQListInfo } from './hooks/useFAQListInfo';
import { useStakingPendingTxsByInfo } from './hooks/useStakingPendingTxs';

import type { IEarnBorrowPagerViewRef } from './components/EarnBorrowPagerView';
import type { IStakePendingTx } from './hooks/useStakingPendingTxs';

const BORROW_PENDING_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});

type IEarnModeSwitchType = 'default' | 'tap' | 'swipe';

function BasicEarnHome({
  showHeader,
  showContent,
  overrideDefaultTab,
  tabsRef,
  useSwipePager,
  earnBorrowPagerRef,
}: {
  showHeader?: boolean;
  showContent?: boolean;
  overrideDefaultTab?: 'assets' | 'portfolio' | 'faqs';
  tabsRef?: React.RefObject<ITabContainerRef | null>;
  useSwipePager?: boolean;
  earnBorrowPagerRef?: React.RefObject<IEarnBorrowPagerViewRef | null>;
}) {
  const route = useAppRoute<ITabEarnParamList, ETabEarnRoutes.EarnHome>();
  const actions = useEarnActions();

  const { isFetchingBlockResult, refreshBlockResult, blockResult } =
    useBlockRegion();

  const { faqList, isFaqLoading, refetchFAQ } = useFAQListInfo();
  const [isEarnTabFocused, setIsEarnTabFocused] = useState(false);
  const [isEarnDataActive, setIsEarnDataActive] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const wasFocusedRef = useRef(false);
  const wasHiddenByModalRef = useRef(false);
  const shouldLogEnterEarnRef = useRef(false);
  const portfolioData = useEarnPortfolio({ isActive: isEarnDataActive });
  const { refresh: refreshEarnDataRaw, isLoading: portfolioLoading } =
    portfolioData;

  const hasPortfolioRows = portfolioData.investments.length > 0;
  const isOverviewRefreshing =
    !(platformEnv.isNative && !showContent) &&
    (isManualRefreshing || !!portfolioLoading);
  const { hideSmallAssets } = useEarnHideSmallAssets();

  // Calculate filtered total fiat value when hiding small assets
  const filteredTotalFiatValue = useMemo(() => {
    if (!hideSmallAssets) {
      return undefined; // Use default from Overview
    }

    const { investments } = portfolioData;
    const total = investments.reduce((sum, inv) => {
      // Filter assets with fiatValueUsd < 0.01
      const valueUsd = Number(inv.totalFiatValueUsd ?? 0);
      if (valueUsd >= 0.01) {
        return sum.plus(new BigNumber(inv.totalFiatValue ?? 0));
      }
      return sum;
    }, new BigNumber(0));

    return total.toFixed();
  }, [hideSmallAssets, portfolioData]);

  // Calculate filtered 24h earnings when hiding small assets (same logic)
  const filteredEarnings24h = useMemo(() => {
    if (!hideSmallAssets) {
      return undefined;
    }

    const { investments } = portfolioData;
    const total = investments.reduce((sum, inv) => {
      const valueUsd = Number(inv.totalFiatValueUsd ?? 0);
      if (valueUsd >= 0.01) {
        return sum.plus(new BigNumber(inv.earnings24hFiatValue ?? 0));
      }
      return sum;
    }, new BigNumber(0));

    return total.toFixed();
  }, [hideSmallAssets, portfolioData]);

  const displayTotalFiatValue = useMemo(() => {
    if (filteredTotalFiatValue !== undefined || !hasPortfolioRows) {
      return filteredTotalFiatValue;
    }

    return portfolioData.investments
      .reduce((sum, inv) => {
        if (inv.assets.length === 0 && inv.airdropAssets.length > 0) {
          return sum;
        }
        return sum.plus(new BigNumber(inv.totalFiatValue || '0'));
      }, new BigNumber(0))
      .toFixed();
  }, [filteredTotalFiatValue, hasPortfolioRows, portfolioData.investments]);

  const displayEarnings24h = useMemo(() => {
    if (filteredEarnings24h !== undefined || !hasPortfolioRows) {
      return filteredEarnings24h;
    }

    return portfolioData.investments
      .reduce((sum, inv) => {
        if (inv.assets.length === 0 && inv.airdropAssets.length > 0) {
          return sum;
        }
        return sum.plus(new BigNumber(inv.earnings24hFiatValue || '0'));
      }, new BigNumber(0))
      .toFixed();
  }, [filteredEarnings24h, hasPortfolioRows, portfolioData.investments]);

  const prefetchEarnAvailableAssets = useCallback(async () => {
    const types = [
      EAvailableAssetsTypeEnum.SimpleEarn,
      EAvailableAssetsTypeEnum.FixedRate,
      EAvailableAssetsTypeEnum.Staking,
    ] as const;

    const results = await Promise.all(
      types.map(async (type) => {
        try {
          const assets =
            await backgroundApiProxy.serviceStaking.getAvailableAssets({
              type,
            });
          return {
            type,
            assets,
          };
        } catch {
          return {
            type,
            assets: [],
          };
        }
      }),
    );

    results.forEach(({ type, assets }) => {
      actions.current.updateAvailableAssetsByType(type, assets);
    });
  }, [actions]);

  const refreshEarnData = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsManualRefreshing(true);
      }

      try {
        await backgroundApiProxy.serviceStaking.clearAvailableAssetsCache();
        await prefetchEarnAvailableAssets();
        actions.current.triggerRefresh();
        await refreshEarnDataRaw();
      } finally {
        if (!silent) {
          setIsManualRefreshing(false);
        }
      }
    },
    [actions, prefetchEarnAvailableAssets, refreshEarnDataRaw],
  );

  const pendingTxsFilter = useCallback((tx: IStakePendingTx) => {
    // Pendle redeem/unstake is recorded as Sell, but it should still trigger
    // the same earn portfolio refresh flow once the pending tx settles.
    return [EEarnLabels.Stake, EEarnLabels.Withdraw, EEarnLabels.Sell].includes(
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
      void refreshEarnData({ silent: true });
    }
    previousIsPendingRef.current = isPending;
  }, [isPending, refreshEarnData]);

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

  const borrowPendingTagMatcher = useCallback(
    (tag: string) => isBorrowTag(tag) || tag === EEarnLabels.Borrow,
    [],
  );

  const { filteredTxs: borrowPendingTxs = [] } = useStakingPendingTxsByInfo({
    networkIds: borrowNetworkIds,
    tagMatcher: borrowPendingTagMatcher,
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

  const navigation = useAppNavigation();

  const defaultTab = overrideDefaultTab || route.params?.tab;
  const defaultMode = route.params?.mode || 'earn';
  const isEarnMode = defaultMode === 'earn';
  const isBorrowMode = defaultMode === 'borrow';
  const earnModeSwitchTypeRef = useRef<IEarnModeSwitchType>('default');
  const hasLoggedEarnModeSwitchRef = useRef(false);
  const defaultModeRef = useRef(defaultMode);
  defaultModeRef.current = defaultMode;

  const earnBorrowScrollPosition = useSharedValue(
    defaultMode === 'borrow' ? 1 : 0,
  );

  const handleModeChange = useCallback(
    (mode: 'earn' | 'borrow', switchType: IEarnModeSwitchType = 'tap') => {
      earnModeSwitchTypeRef.current = switchType;
      // Use setParams to update mode without navigation - prevents remount flash
      navigation.setParams({ mode, tab: route.params?.tab });
    },
    [navigation, route.params?.tab],
  );

  useEffect(() => {
    if (!showContent || !isEarnTabFocused) {
      return;
    }

    const switchType = hasLoggedEarnModeSwitchRef.current
      ? earnModeSwitchTypeRef.current
      : 'default';

    const shouldLogEnterEarn = shouldLogEnterEarnRef.current;
    shouldLogEnterEarnRef.current = false;
    if (shouldLogEnterEarn && defaultMode === 'earn') {
      defaultLogger.staking.page.enterEarn();
    }
    hasLoggedEarnModeSwitchRef.current = true;
    defaultLogger.staking.page.earnModeSwitch({
      mode: defaultMode,
      switchType,
    });
    earnModeSwitchTypeRef.current = 'default';
  }, [defaultMode, isEarnTabFocused, showContent]);

  useEffect(() => {
    const handleSwitchEarnMode = ({
      mode,
      switchType,
    }: {
      mode: 'earn' | 'borrow';
      switchType?: IEarnModeSwitchType;
    }) => {
      if (mode !== defaultMode) {
        handleModeChange(mode, switchType ?? 'default');
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchEarnMode, handleSwitchEarnMode);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchEarnMode, handleSwitchEarnMode);
    };
  }, [defaultMode, handleModeChange]);

  const media = useMedia();
  const earnFocusTabRoutes = useMemo(
    () =>
      platformEnv.isNative
        ? [ETabRoutes.Earn, ETabRoutes.Discovery]
        : [ETabRoutes.Earn],
    [],
  );

  const handleListenTabFocusState = useCallback(
    (isFocus: boolean, isHideByModal: boolean) => {
      const { isVisibleFocus, isDataActive } = getEarnFocusState({
        isFocus,
        isHideByModal,
      });
      const wasFocused = wasFocusedRef.current;
      const wasHiddenByModal = wasHiddenByModalRef.current;
      wasHiddenByModalRef.current = isFocus && isHideByModal;
      wasFocusedRef.current = isVisibleFocus;
      // Closing a modal restores focus, but is not a fresh Earn entry.
      if (isVisibleFocus && !wasFocused && !wasHiddenByModal) {
        shouldLogEnterEarnRef.current = true;
      }
      setIsEarnTabFocused(isVisibleFocus);
      setIsEarnDataActive(isDataActive);
      if (!isVisibleFocus) return;

      void prefetchEarnAvailableAssets();

      const simpleKey = `availableAssets-${EAvailableAssetsTypeEnum.SimpleEarn}`;
      const fixedKey = `availableAssets-${EAvailableAssetsTypeEnum.FixedRate}`;
      const stakingKey = `availableAssets-${EAvailableAssetsTypeEnum.Staking}`;

      const keys = [simpleKey, fixedKey, stakingKey];

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
    [actions, prefetchEarnAvailableAssets, refetchFAQ],
  );

  useListenTabFocusState(earnFocusTabRoutes, handleListenTabFocusState);

  const handleHeaderHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const currentMode = defaultModeRef.current;
      if (direction === 'left' && currentMode === 'earn') {
        handleModeChange('borrow', 'swipe');
      } else if (direction === 'right' && currentMode === 'borrow') {
        handleModeChange('earn', 'swipe');
      } else if (direction === 'right' && currentMode === 'earn') {
        appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
          tab: ETranslations.global_market,
          switchType: 'swipe',
        });
      }
    },
    [handleModeChange],
  );

  const mobileContainerProps = useMemo(
    () => ({
      contentContainerStyle: {
        display: showContent ? undefined : 'none',
      },
      allowHeaderOverscroll: true,
      renderHeader: () => (
        <HeaderScrollGestureWrapper
          onHorizontalSwipe={handleHeaderHorizontalSwipe}
        >
          <YStack gap="$4" pt={24} pb={20} bg="$bgApp" pointerEvents="box-none">
            <YStack gap="$7.5">
              <YStack px="$pagePadding">
                <Overview
                  onRefresh={refreshEarnData}
                  isLoading={isOverviewRefreshing}
                  displayTotalFiatValue={displayTotalFiatValue}
                  displayEarnings24h={displayEarnings24h}
                />
              </YStack>
            </YStack>
          </YStack>
        </HeaderScrollGestureWrapper>
      ),
    }),
    [
      showContent,
      refreshEarnData,
      isOverviewRefreshing,
      displayTotalFiatValue,
      displayEarnings24h,
      handleHeaderHorizontalSwipe,
    ],
  );

  // const [tabPageHeight, setTabPageHeight] = useState(
  //   platformEnv.isNativeIOS ? 143 : 92,
  // );
  // const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
  //   const height = e.nativeEvent.layout.height - 20;
  //   setTabPageHeight(height);
  // }, []);

  if (blockResult?.blockData) {
    return (
      <EarnBlockedOverview
        showHeader={showHeader}
        showContent={showContent}
        refresh={refreshBlockResult}
        refreshing={!!isFetchingBlockResult}
        illustration="Universal"
        title={blockResult.blockData.title.text}
        description={blockResult.blockData.description.text}
      />
    );
  }

  if (platformEnv.isNative) {
    // Phone with swipe pager: EarnBorrowPagerView replaces display:none/flex
    if (useSwipePager) {
      return (
        <YStack flex={1}>
          <MarketSelector
            mode={defaultMode}
            onModeChange={handleModeChange}
            pageScrollPosition={earnBorrowScrollPosition}
          />
          <EarnBorrowPagerView
            ref={earnBorrowPagerRef}
            mode={defaultMode}
            onModeChange={handleModeChange}
            pageScrollPosition={earnBorrowScrollPosition}
            earnContent={
              <>
                <EarnMainTabs
                  faqList={faqList || []}
                  isFaqLoading={isFaqLoading}
                  defaultTab={defaultTab}
                  portfolioData={portfolioData}
                  containerProps={mobileContainerProps}
                  tabsRef={tabsRef}
                  nestedPager={useSwipePager}
                />
                {showHeader && showContent ? (
                  <YStack
                    position="absolute"
                    top={-20}
                    left={0}
                    bg="$bgApp"
                    pt="$5"
                    width="100%"
                  >
                    <TabPageHeader
                      sceneName={EAccountSelectorSceneName.home}
                      tabRoute={ETabRoutes.Earn}
                    />
                  </YStack>
                ) : null}
              </>
            }
            borrowContent={
              <BorrowHome
                isActive={isBorrowMode}
                pendingTxs={borrowPendingTxs}
                onRegisterBorrowRefresh={handleRegisterBorrowRefresh}
                onBorrowNetworksChange={handleBorrowNetworksChange}
              />
            }
          />
        </YStack>
      );
    }

    // Tablet / dual-screen: keep existing display:none/flex logic
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
            tabsRef={tabsRef}
          />

          {showHeader && showContent && media.md ? (
            <YStack
              position="absolute"
              top={-20}
              left={0}
              bg="$bgApp"
              pt="$5"
              width="100%"
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
        contentContainerStyle={{
          py: 0,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isOverviewRefreshing}
            onRefresh={refreshEarnData}
          />
        }
      >
        <EarnHomeTabs
          defaultMode={defaultMode}
          onModeChange={handleModeChange}
          earn={
            <YStack
              {...(platformEnv.isDesktop ? undefined : { flex: 1 })}
              gap={20}
            >
              <YStack>
                <XStack px="$pagePadding">
                  <Overview
                    onRefresh={refreshEarnData}
                    isLoading={isOverviewRefreshing}
                    displayTotalFiatValue={displayTotalFiatValue}
                    displayEarnings24h={displayEarnings24h}
                  />
                </XStack>
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
  tabsRef,
  useSwipePager,
  earnBorrowPagerRef,
}: {
  showHeader?: boolean;
  showContent?: boolean;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
  tabsRef?: React.RefObject<ITabContainerRef | null>;
  useSwipePager?: boolean;
  earnBorrowPagerRef?: React.RefObject<IEarnBorrowPagerViewRef | null>;
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
          tabsRef={tabsRef}
          useSwipePager={useSwipePager}
          earnBorrowPagerRef={earnBorrowPagerRef}
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default function EarnHome() {
  return platformEnv.isNative ? null : <EarnHomeWithProvider />;
}
