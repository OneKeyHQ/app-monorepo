import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  Stack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { EarnProviderMirror } from '../../Earn/EarnProviderMirror';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { EarnListView } from '../components/EarnListView';
import { HomeScrollView } from '../components/HomeScrollView';
import { HomeStickyHeaderContext } from '../components/HomeStickyHeaderContext';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PopularTrading } from '../components/PopularTrading';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { TokenListBlock } from '../components/TokenListBlock';
import { Upgrade } from '../components/Upgrade';
import { PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH } from '../types';

import { findScrollableAncestorFromLocalNode } from './defiDesktopStickyDom';
import { buildPortfolioSidebarStickyStyle } from './portfolioSidebarSticky';

// Visual max-width for the wallet page main content. Has to match the
// `regular` layout previously applied at the Page.Container level so the page
// doesn't suddenly widen when the page-level constraint was removed (see
// HomePageView's `homePageContentMaxWidthSx` and the comment there).
const PORTFOLIO_CONTENT_MAX_WIDTH = 1140;

function PortfolioContainer() {
  const media = useMedia();

  const tableLayout = media.gtMd;
  const showRecentHistory = media.gtXl;
  const stickyHeaderCtx = useContext(HomeStickyHeaderContext);
  const isTabFocused =
    stickyHeaderCtx?.activeTabId === EHomeWalletTab.Portfolio;
  const [isHomeRouteVisible, setIsHomeRouteVisible] = useState(false);
  const handleHomeRouteFocusChange = useCallback(
    (isFocus: boolean, isHideByModal: boolean) => {
      setIsHomeRouteVisible(isFocus && !isHideByModal);
    },
    [],
  );

  useListenTabFocusState(ETabRoutes.Home, handleHomeRouteFocusChange);

  // Height of the page scroller the sidebar sticks inside. Only a size is
  // observed (never a position), so a stale value while the Home tab is
  // hidden can at worst shorten the cap by a few pixels until the next
  // resize; it can never move the sidebar.
  const [scrollerHeight, setScrollerHeight] = useState(0);
  const [sidebarNode, setSidebarNode] = useState<HTMLElement | null>(null);
  const registerSidebarRef = useCallback((node: unknown) => {
    setSidebarNode(
      typeof HTMLElement !== 'undefined' && node instanceof HTMLElement
        ? node
        : null,
    );
  }, []);

  useEffect(() => {
    if (
      platformEnv.isNative ||
      !sidebarNode ||
      typeof ResizeObserver === 'undefined'
    ) {
      return undefined;
    }
    const scroller = findScrollableAncestorFromLocalNode(sidebarNode);
    if (!scroller) {
      return undefined;
    }
    const sync = () => {
      const next = scroller.clientHeight;
      setScrollerHeight((prev) => (prev === next ? prev : next));
    };
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);
    sync();
    return () => observer.disconnect();
  }, [sidebarNode]);

  const sidebarStickyStyle = useMemo(
    () =>
      platformEnv.isNative
        ? undefined
        : buildPortfolioSidebarStickyStyle({ scrollerHeight }),
    [scrollerHeight],
  );

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );
  const isEarnListActive = isTabFocused && isHomeRouteVisible;

  // Use a stable tree structure (Stack > YStack > children) regardless of
  // layout mode so that TokenListBlock is never unmounted/remounted when the
  // viewport crosses the mobile/desktop breakpoint.  Remounting resets the
  // All-Networks loading state while the page is "unfocused" (modal open),
  // which causes the token list to be stuck in a loading state.
  return (
    <>
      <Stack
        flexDirection={tableLayout ? 'row' : 'column'}
        pt="$3"
        gap="$6"
        width="100%"
        $gtMd={{ maxWidth: PORTFOLIO_CONTENT_MAX_WIDTH, mx: 'auto' }}
      >
        <YStack
          flex={1}
          gap={tableLayout ? '$10' : '$6'}
          pb={tableLayout ? '$8' : '$4'}
        >
          <TokenListBlock
            showRecentHistory={tableLayout ? showRecentHistory : undefined}
            tableLayout={tableLayout || undefined}
          />
          <DeFiListBlock refreshCacheOnly />
          <PopularTrading tableLayout={tableLayout || undefined} />
          <EarnListView isActive={isEarnListActive} />
          <Upgrade />
          <SupportHub />
        </YStack>
        {tableLayout && showRecentHistory ? (
          // The shell stretches to the row height; the inner column sticks
          // below the pager tab bar while the shell is in view.
          <YStack
            ref={registerSidebarRef as any}
            width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
            flexShrink={0}
          >
            <YStack
              width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
              {...(sidebarStickyStyle as any)}
            >
              <RecentHistory />
            </YStack>
          </YStack>
        ) : null}
        {addPaddingOnListFooter ? <Stack h="$16" /> : null}
      </Stack>
    </>
  );
}

function PortfolioContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const tabBarHeight = useScrollContentTabBarOffset();
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextHistoryList>
        <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
          <ProviderJotaiContextDeFiList>
            <HomeScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: tabBarHeight }}
              nestedScrollEnabled={platformEnv.isNativeAndroid}
              refreshControl={
                !platformEnv.isNativeAndroid ? (
                  <PullToRefresh onRefresh={onHomePageRefresh} />
                ) : undefined
              }
            >
              <PortfolioContainer />
            </HomeScrollView>
          </ProviderJotaiContextDeFiList>
        </EarnProviderMirror>
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
