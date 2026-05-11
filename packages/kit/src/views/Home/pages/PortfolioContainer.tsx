import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Stack,
  Tabs,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ProviderJotaiContextDeFiList } from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import { EarnProviderMirror } from '../../Earn/EarnProviderMirror';
import { DeFiListBlock } from '../components/DeFiListBlock';
import { EarnListView } from '../components/EarnListView';
import { HomeStickyHeaderContext } from '../components/HomeStickyHeaderContext';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PopularTrading } from '../components/PopularTrading';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RecentHistory } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { TokenListBlock } from '../components/TokenListBlock';
import { Upgrade } from '../components/Upgrade';
import {
  PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH,
  STICKY_TOP_OFFSET,
} from '../types';

import {
  findScrollableAncestorFromLocalNode,
  getStickySidebarMaxHeight,
} from './defiDesktopStickyDom';
import { HOME_PAGE_CONTENT_MAX_WIDTH } from './homePageContentMaxWidth';

const SIDEBAR_STICKY_UNPIN_GAP = 8;

function PortfolioContainer() {
  const media = useMedia();

  const tableLayout = media.gtMd;
  const showRecentHistory = media.gtXl;
  const stickyHeaderCtx = useContext(HomeStickyHeaderContext);
  const isTabFocused =
    stickyHeaderCtx?.activeTabId === EHomeWalletTab.Portfolio;

  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarContentRef = useRef<HTMLElement | null>(null);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [sidebarShellHeight, setSidebarShellHeight] = useState(0);
  const [sidebarFixedLeft, setSidebarFixedLeft] = useState(0);
  const [sidebarStickyTop, setSidebarStickyTop] = useState(STICKY_TOP_OFFSET);
  const [stickyLine, setStickyLine] = useState(STICKY_TOP_OFFSET);

  useEffect(() => {
    if (platformEnv.isNative || !tableLayout || !showRecentHistory) {
      setIsSidebarPinned(false);
      return;
    }

    let raf = 0;
    let attachedScroller: HTMLElement | null = null;
    const scrollOpts: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    const resolveOriginNode = () => {
      const sidebarNode = sidebarRef.current;
      return sidebarNode?.isConnected ? sidebarNode : null;
    };

    let check = () => {};
    let syncScrollerSubscription = () => {};
    const schedule = () => {
      syncScrollerSubscription();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };

    syncScrollerSubscription = () => {
      const originNode = resolveOriginNode();
      const nextScroller = originNode
        ? findScrollableAncestorFromLocalNode(originNode)
        : null;

      if (attachedScroller === nextScroller) {
        return;
      }

      if (attachedScroller) {
        attachedScroller.removeEventListener('scroll', schedule, scrollOpts);
      }

      attachedScroller = nextScroller;

      if (attachedScroller) {
        attachedScroller.addEventListener('scroll', schedule, scrollOpts);
      }
    };

    check = () => {
      syncScrollerSubscription();

      const stickyHostRect =
        stickyHeaderCtx?.stickyHost?.getBoundingClientRect() ?? null;
      const nextSidebarStickyTop =
        stickyHostRect && stickyHostRect.bottom > 0
          ? stickyHostRect.bottom
          : STICKY_TOP_OFFSET;
      setSidebarStickyTop((prev) =>
        prev === nextSidebarStickyTop ? prev : nextSidebarStickyTop,
      );
      setStickyLine((prev) =>
        prev === nextSidebarStickyTop ? prev : nextSidebarStickyTop,
      );

      const sidebarAnchor = sidebarRef.current;
      if (!isTabFocused || !sidebarAnchor?.isConnected) {
        setIsSidebarPinned(false);
        return;
      }

      const sidebarRect = sidebarAnchor.getBoundingClientRect();
      const measuredContentHeight =
        sidebarContentRef.current?.getBoundingClientRect().height ??
        sidebarRect.height;
      const measuredHeight = Math.max(
        sidebarRect.height,
        measuredContentHeight,
      );
      setSidebarShellHeight((prev) =>
        prev === measuredHeight ? prev : measuredHeight,
      );
      setSidebarFixedLeft((prev) =>
        prev === sidebarRect.left ? prev : sidebarRect.left,
      );

      setIsSidebarPinned((prev) => {
        const nextIsSidebarPinned = prev
          ? sidebarRect.top <= nextSidebarStickyTop + SIDEBAR_STICKY_UNPIN_GAP
          : sidebarRect.top <= nextSidebarStickyTop;
        return prev === nextIsSidebarPinned ? prev : nextIsSidebarPinned;
      });
    };

    syncScrollerSubscription();
    globalThis.addEventListener('resize', schedule);
    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (attachedScroller) {
        attachedScroller.removeEventListener('scroll', schedule, scrollOpts);
      }
      globalThis.removeEventListener('resize', schedule);
    };
  }, [
    isTabFocused,
    stickyHeaderCtx?.stickyHost,
    tableLayout,
    showRecentHistory,
  ]);

  const registerSidebarRef = useCallback((node: unknown) => {
    sidebarRef.current = node as HTMLElement | null;
  }, []);

  const registerSidebarContentRef = useCallback((node: unknown) => {
    sidebarContentRef.current = node as HTMLElement | null;
  }, []);

  const stickySidebarMaxHeight = getStickySidebarMaxHeight({
    viewportHeight: globalThis.window?.innerHeight ?? 0,
    stickyLine,
    bottomGap: 16,
  });

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

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
        $gtMd={{ maxWidth: HOME_PAGE_CONTENT_MAX_WIDTH, mx: 'auto' }}
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
          <EarnListView />
          <Upgrade />
          <SupportHub />
        </YStack>
        {tableLayout && showRecentHistory ? (
          <YStack
            ref={registerSidebarRef as any}
            width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
            flexShrink={0}
            height={isSidebarPinned ? sidebarShellHeight : undefined}
          >
            <YStack
              ref={registerSidebarContentRef as any}
              width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
              {...(isSidebarPinned
                ? {
                    position: 'fixed' as any,
                    top: sidebarStickyTop,
                    left: sidebarFixedLeft,
                    maxHeight: stickySidebarMaxHeight,
                    overflow: 'scroll' as any,
                    zIndex: 1,
                  }
                : null)}
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
            <Tabs.ScrollView
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
            </Tabs.ScrollView>
          </ProviderJotaiContextDeFiList>
        </EarnProviderMirror>
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
PortfolioContainerWithProvider.displayName = 'PortfolioContainerWithProvider';

export { PortfolioContainerWithProvider };
