import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import {
  Stack,
  Tabs,
  XStack,
  YStack,
  useCurrentTabScrollY,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { useTabsContext } from '@onekeyhq/components/src/composite/Tabs/context';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { BackToTopButton } from '../../../components/BackToTopButton';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextDeFiList,
  useDeFiListProtocolMapAtom,
  useDeFiListProtocolsAtom,
  useDeFiListStateAtom,
} from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import { buildProtocolDisplayInfo } from '../../../utils/defiPositionUtils';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import {
  DeFiListBlock,
  DeFiOverviewCard,
  DeFiPortfolioCard,
  DeFiStickyPortal,
  type IProtocolHandle,
  PinnedProtocolHeader,
} from '../components/DeFiListBlock';
import { buildPortfolioStats } from '../components/DeFiListBlock/DeFiPortfolioStats';
import { HomeStickyHeaderContext } from '../components/HomeStickyHeaderContext';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RecentHistory, RecentHistoryTitle } from '../components/RecentHistory';
import { SupportHub } from '../components/SupportHub';
import { Upgrade } from '../components/Upgrade';
import {
  PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH,
  STICKY_TOP_OFFSET,
} from '../types';

import {
  findPinnedProtocolKey,
  findScrollableAncestorFromLocalNode,
  getStickySidebarMaxHeight,
} from './defiDesktopStickyDom';

// Scroll depth beyond which back-to-top may reveal; deep enough to be past
// the initial fold, shallow enough to not require a full viewport of scroll.
const BACK_TO_TOP_NEAR_TOP_PX = 200;
const PROTOCOL_PINNED_HEADER_EXIT_GAP = 64;
const SIDEBAR_STICKY_UNPIN_GAP = 8;

// Industry pattern: reveal on any upward scroll past the initial fold; hide
// on downward scroll or when back near the top. rAF / animated-reaction
// throttles already absorb wheel jitter, so no extra dead zone. Returns
// `previous` when direction is neutral so callers can dedup by identity.
function decideBackToTopVisible(
  current: number,
  last: number,
  previous: boolean,
): boolean {
  if (current <= BACK_TO_TOP_NEAR_TOP_PX) return false;
  if (current < last) return true;
  if (current > last) return false;
  return previous;
}

function scrollToAnchor(
  anchor: HTMLElement,
  offset: number,
  behavior: ScrollBehavior,
) {
  const scroller = findScrollableAncestorFromLocalNode(anchor);
  const anchorRect = anchor.getBoundingClientRect();

  if (!scroller) {
    const targetY = Math.max(0, anchorRect.top + globalThis.scrollY - offset);
    globalThis.scrollTo({ top: targetY, behavior });
    return;
  }

  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const scrollerRect = scroller.getBoundingClientRect();
  const targetY = Math.min(
    maxScroll,
    Math.max(
      0,
      anchorRect.top - scrollerRect.top + scroller.scrollTop - offset,
    ),
  );
  scroller.scrollTo({ top: targetY, behavior });
}

function DeFiContainer() {
  const media = useMedia();
  const reducedMotion = useReducedMotion();

  const tableLayout = media.gtMd;
  const showRecentHistory = media.gtXl;

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const isAllNetworks = Boolean(network?.isAllNetworks);

  const [{ protocols }] = useDeFiListProtocolsAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const isOverviewLoading =
    !initialized || (isRefreshing && (protocols?.length ?? 0) === 0);

  const triggerPinCheckRef = useRef<() => void>(() => {});
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const protocolRefs = useRef<Map<string, IProtocolHandle>>(new Map());
  const registerProtocol = useCallback(
    (key: string, handle: IProtocolHandle | null) => {
      const currentHandle = protocolRefs.current.get(key) ?? null;
      const changed = currentHandle !== handle;

      if (handle) {
        protocolRefs.current.set(key, handle);
      } else {
        protocolRefs.current.delete(key);
      }

      if (changed && !platformEnv.isNative && tableLayout) {
        triggerPinCheckRef.current();
      }
    },
    [tableLayout],
  );

  const getNetWorth = useCallback(
    (p: IDeFiProtocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });
      const info = buildProtocolDisplayInfo({
        protocol: p,
        protocolInfo: protocolMap[key],
      });
      const nw = new BigNumber(info.netWorth);
      return nw.isFinite() ? nw.toNumber() : 0;
    },
    [protocolMap],
  );

  const portfolioStats = useMemo(
    () =>
      buildPortfolioStats({
        protocols,
        protocolMap,
        getNetWorth,
      }),
    [protocols, protocolMap, getNetWorth],
  );

  const stickyHeaderCtx = useContext(HomeStickyHeaderContext);
  const portalTarget = stickyHeaderCtx?.portalTarget ?? null;
  const tabBarRightPortalTarget =
    stickyHeaderCtx?.tabBarRightPortalTarget ?? null;
  const isTabFocused = stickyHeaderCtx?.activeTabId === EHomeWalletTab.DeFi;
  const getLiveStickyOffset = useCallback(() => {
    const stickyBottom =
      stickyHeaderCtx?.stickyHost?.getBoundingClientRect().bottom ?? 0;
    return stickyBottom > 0 ? stickyBottom : STICKY_TOP_OFFSET;
  }, [stickyHeaderCtx?.stickyHost]);

  const handleTilePress = useCallback(
    (p: IDeFiProtocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });
      const handle = protocolRefs.current.get(key);
      if (!handle) {
        return;
      }

      handle.expand();

      if (platformEnv.isNative || typeof requestAnimationFrame !== 'function') {
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const anchor = handle.getAnchor();
          if (!anchor) return;
          const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
          scrollToAnchor(anchor, getLiveStickyOffset(), behavior);
        });
      });
    },
    [getLiveStickyOffset, reducedMotion],
  );

  const shouldShowOverview =
    tableLayout && (isOverviewLoading || (protocols?.length ?? 0) >= 2);

  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const suppressPinRef = useRef(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarContentRef = useRef<HTMLElement | null>(null);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [sidebarShellHeight, setSidebarShellHeight] = useState(0);
  const [sidebarFixedLeft, setSidebarFixedLeft] = useState(0);
  const [sidebarStickyTop, setSidebarStickyTop] = useState(STICKY_TOP_OFFSET);
  const [stickyLine, setStickyLine] = useState(STICKY_TOP_OFFSET);

  useEffect(() => {
    if (platformEnv.isNative || !tableLayout) {
      return;
    }

    let raf = 0;
    let attachedScroller: HTMLElement | null = null;
    const scrollOpts: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    const resolveOriginNode = () => {
      if (showRecentHistory) {
        const sidebarNode = sidebarRef.current;
        return sidebarNode?.isConnected ? sidebarNode : null;
      }

      for (const handle of protocolRefs.current.values()) {
        const anchor = handle.getAnchor();
        if (anchor?.isConnected) {
          return anchor;
        }
      }

      return null;
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
        scrollContainerRef.current = nextScroller;
        return;
      }

      if (attachedScroller) {
        attachedScroller.removeEventListener('scroll', schedule, scrollOpts);
      }

      attachedScroller = nextScroller;
      scrollContainerRef.current = nextScroller;

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
      const nextStickyLine =
        stickyHostRect && stickyHostRect.bottom > 0
          ? stickyHostRect.bottom
          : STICKY_TOP_OFFSET;
      setSidebarStickyTop((prev) =>
        prev === nextSidebarStickyTop ? prev : nextSidebarStickyTop,
      );
      setStickyLine((prev) =>
        prev === nextStickyLine ? prev : nextStickyLine,
      );

      const disconnectedKeys: string[] = [];
      const candidates: Array<{
        key: string;
        top: number;
        bottom: number;
        width: number;
      }> = [];

      for (const [key, handle] of protocolRefs.current) {
        const anchor = handle.getAnchor();
        if (!anchor?.isConnected) {
          disconnectedKeys.push(key);
          // eslint-disable-next-line no-continue
          continue;
        }
        const rect = anchor.getBoundingClientRect();
        const distanceToSticky = rect.top - nextStickyLine;
        handle.setCompactProgress(
          Math.max(0, Math.min(1, 1 - distanceToSticky / 16)),
        );
        candidates.push({
          key,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        });
      }

      if (disconnectedKeys.length > 0) {
        disconnectedKeys.forEach((key) => {
          protocolRefs.current.delete(key);
        });
      }

      const sidebarAnchor = sidebarRef.current;
      if (!showRecentHistory || !isTabFocused || !sidebarAnchor?.isConnected) {
        setIsSidebarPinned(false);
      } else {
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
      }

      if (suppressPinRef.current) return;

      const nextKey =
        (isTabFocused
          ? findPinnedProtocolKey({
              stickyLine: nextStickyLine,
              pinnedHeaderHeight: PROTOCOL_PINNED_HEADER_EXIT_GAP,
              candidates,
            })
          : null) ?? null;
      setPinnedKey((prev) => (prev === nextKey ? prev : nextKey));
    };

    syncScrollerSubscription();
    globalThis.addEventListener('resize', schedule);
    triggerPinCheckRef.current = schedule;
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (attachedScroller) {
        attachedScroller.removeEventListener('scroll', schedule, scrollOpts);
      }
      scrollContainerRef.current = null;
      globalThis.removeEventListener('resize', schedule);
      triggerPinCheckRef.current = () => {};
    };
  }, [
    isTabFocused,
    stickyHeaderCtx?.stickyHost,
    tableLayout,
    showRecentHistory,
  ]);

  useEffect(() => {
    if (isTabFocused) {
      return;
    }
    setPinnedKey(null);
    setIsSidebarPinned(false);
  }, [isTabFocused]);

  useEffect(() => {
    if (showRecentHistory) {
      return;
    }
    setIsSidebarPinned(false);
  }, [showRecentHistory]);

  useEffect(() => {
    if (!pinnedKey || !protocols) {
      return;
    }

    const stillExists = protocols.some(
      (p) =>
        defiUtils.buildProtocolMapKey({
          protocol: p.protocol,
          networkId: p.networkId,
        }) === pinnedKey,
    );

    if (!stillExists) {
      setPinnedKey(null);
    }
  }, [pinnedKey, protocols]);

  const pinnedProtocol = useMemo(() => {
    if (!pinnedKey || !protocols) {
      return null;
    }
    return (
      protocols.find(
        (p) =>
          defiUtils.buildProtocolMapKey({
            protocol: p.protocol,
            networkId: p.networkId,
          }) === pinnedKey,
      ) ?? null
    );
  }, [pinnedKey, protocols]);

  const pinnedNetWorth = useMemo(() => {
    if (!pinnedProtocol) return 0;
    return getNetWorth(pinnedProtocol);
  }, [pinnedProtocol, getNetWorth]);

  const stickySidebarMaxHeight = getStickySidebarMaxHeight({
    viewportHeight: globalThis.window?.innerHeight ?? 0,
    stickyLine,
    bottomGap: 16,
  });

  const hasStickyOverlay = Boolean(pinnedProtocol);

  const handlePinnedToggle = useCallback(() => {
    if (!pinnedKey) return;
    const handle = protocolRefs.current.get(pinnedKey);
    if (!handle) return;
    const anchor = handle.getAnchor();
    if (!anchor) return;

    suppressPinRef.current = true;
    setPinnedKey(null);

    requestAnimationFrame(() => {
      if (anchor.isConnected) {
        const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
        scrollToAnchor(anchor, getLiveStickyOffset(), behavior);
      }
      const suppressMs = reducedMotion ? 50 : 400;
      setTimeout(() => {
        suppressPinRef.current = false;
        triggerPinCheckRef.current();
      }, suppressMs);
    });
  }, [getLiveStickyOffset, pinnedKey, reducedMotion]);

  if (tableLayout) {
    return (
      <>
        <XStack gap="$6">
          <YStack flex={1} gap="$8" pt="$3" pb="$8">
            {shouldShowOverview ? (
              <YStack gap="$6" px="$pagePadding" userSelect="none">
                <DeFiPortfolioCard
                  stats={portfolioStats}
                  isLoading={isOverviewLoading}
                  isAllNetworks={isAllNetworks}
                />
                <DeFiOverviewCard
                  protocols={protocols}
                  protocolMap={protocolMap}
                  isLoading={isOverviewLoading}
                  getNetWorth={getNetWorth}
                  onPressProtocol={handleTilePress}
                  isAllNetworks={isAllNetworks}
                />
              </YStack>
            ) : null}
            <DeFiListBlock
              tableLayout
              hideInternalTitle={shouldShowOverview}
              registerProtocol={registerProtocol}
            />
            <Upgrade />
            <SupportHub />
          </YStack>
          {showRecentHistory ? (
            <YStack
              ref={(node) => {
                sidebarRef.current = node as unknown as HTMLElement | null;
              }}
              width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
              flexShrink={0}
              height={isSidebarPinned ? sidebarShellHeight : undefined}
            >
              <YStack
                ref={(node) => {
                  sidebarContentRef.current =
                    node as unknown as HTMLElement | null;
                }}
                width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
                pt={isSidebarPinned ? '$0' : '$3'}
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
                <RecentHistory hideTitle={isSidebarPinned} />
              </YStack>
            </YStack>
          ) : null}
          {addPaddingOnListFooter ? <Stack h="$16" /> : null}
        </XStack>
        {portalTarget && isTabFocused && hasStickyOverlay ? (
          <DeFiStickyPortal target={portalTarget}>
            {/* Pull up by Tabs.TabBar's own py="$2" bottom padding so the
                pinned card sits flush under the pill row. Without this, the
                gap shows as a visible $bgApp band above $bgSubdued card. */}
            <XStack
              gap="$6"
              px="$pagePadding"
              pt="$0"
              mt="$-2"
              userSelect="none"
            >
              <YStack
                flex={1}
                pointerEvents={pinnedProtocol ? 'auto' : 'none'}
                animation={reducedMotion ? undefined : 'quick'}
                animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                opacity={pinnedProtocol ? 1 : 0}
                scale={1}
                y={0}
              >
                {pinnedProtocol ? (
                  <PinnedProtocolHeader
                    protocol={pinnedProtocol}
                    protocolInfo={
                      protocolMap[
                        defiUtils.buildProtocolMapKey({
                          protocol: pinnedProtocol.protocol,
                          networkId: pinnedProtocol.networkId,
                        })
                      ]
                    }
                    netWorth={pinnedNetWorth}
                    currencySymbol={currencySymbol}
                    isAllNetworks={isAllNetworks}
                    reducedMotion={reducedMotion}
                    onToggle={handlePinnedToggle}
                  />
                ) : null}
              </YStack>
              {showRecentHistory ? (
                <Stack
                  width={PORTFOLIO_CONTAINER_RIGHT_SIDE_FIXED_WIDTH}
                  flexShrink={0}
                />
              ) : null}
            </XStack>
          </DeFiStickyPortal>
        ) : null}
        {tabBarRightPortalTarget &&
        showRecentHistory &&
        isTabFocused &&
        isSidebarPinned ? (
          <DeFiStickyPortal target={tabBarRightPortalTarget}>
            <RecentHistoryTitle />
          </DeFiStickyPortal>
        ) : null}
      </>
    );
  }

  return (
    <YStack gap="$6" pb="$5">
      <DeFiListBlock />
      <Upgrade />
      <SupportHub />
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </YStack>
  );
}

function DeFiContainerScrollableNative() {
  const tabBarOffset = useScrollContentTabBarOffset();

  const scrollYShared = useCurrentTabScrollY();
  const { refMap, focusedTab } = useTabsContext();

  const [backToTopVisible, setBackToTopVisible] = useState(false);
  const lastVisibleShared = useSharedValue(false);

  // UI-thread dedup: only cross the RN bridge when the decision flips.
  useAnimatedReaction(
    () => scrollYShared.value as number,
    (current, previous) => {
      if (previous === null) return;
      const next = decideBackToTopVisible(
        current,
        previous,
        lastVisibleShared.value,
      );
      if (next !== lastVisibleShared.value) {
        lastVisibleShared.value = next;
        runOnJS(setBackToTopVisible)(next);
      }
    },
    [scrollYShared],
  );

  const onPressBackToTop = useCallback(() => {
    runOnUI(() => {
      'worklet';

      const ref = refMap[focusedTab.value];
      if (ref) {
        scrollTo(ref, 0, 0, true);
      }
    })();
  }, [refMap, focusedTab]);

  return (
    <Stack flex={1}>
      <Tabs.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarOffset }}
        nestedScrollEnabled={platformEnv.isNativeAndroid}
        refreshControl={
          !platformEnv.isNativeAndroid ? (
            <PullToRefresh onRefresh={onHomePageRefresh} />
          ) : undefined
        }
      >
        <DeFiContainer />
      </Tabs.ScrollView>
      <BackToTopButton
        visible={backToTopVisible}
        onPress={onPressBackToTop}
        placement="left"
      />
    </Stack>
  );
}

function DeFiContainerScrollableWeb() {
  const tabBarOffset = useScrollContentTabBarOffset();
  const sentinelRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const lastVisibleRef = useRef(false);
  const [backToTopVisible, setBackToTopVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let attachedScroller: HTMLElement | null = null;
    let scrollRafId = 0;
    let attachRafId = 0;
    const scrollOpts: AddEventListenerOptions = { passive: true };

    const onScroll = () => {
      if (scrollRafId || !attachedScroller) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = 0;
        if (!attachedScroller) return;
        const current = attachedScroller.scrollTop;
        const last = lastScrollTopRef.current;
        lastScrollTopRef.current = current;
        const next = decideBackToTopVisible(
          current,
          last,
          lastVisibleRef.current,
        );
        if (next !== lastVisibleRef.current) {
          lastVisibleRef.current = next;
          setBackToTopVisible(next);
        }
      });
    };

    const detachScroller = () => {
      if (attachedScroller) {
        attachedScroller.removeEventListener('scroll', onScroll, scrollOpts);
      }
      attachedScroller = null;
      scrollerRef.current = null;
    };

    const attachScroller = () => {
      const nextScroller = findScrollableAncestorFromLocalNode(sentinel);
      if (nextScroller === attachedScroller) {
        scrollerRef.current = nextScroller;
        return;
      }

      detachScroller();
      attachedScroller = nextScroller;
      scrollerRef.current = nextScroller;

      if (attachedScroller) {
        attachedScroller.addEventListener('scroll', onScroll, scrollOpts);
        lastScrollTopRef.current = attachedScroller.scrollTop;
      }
    };

    const scheduleAttach = () => {
      if (attachRafId) cancelAnimationFrame(attachRafId);
      attachRafId = requestAnimationFrame(() => {
        attachRafId = 0;
        attachScroller();
      });
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(scheduleAttach);
    resizeObserver?.observe(sentinel);
    if (sentinel.parentElement) {
      resizeObserver?.observe(sentinel.parentElement);
    }

    attachScroller();
    globalThis.addEventListener('resize', scheduleAttach);

    return () => {
      globalThis.removeEventListener('resize', scheduleAttach);
      resizeObserver?.disconnect();
      detachScroller();
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      if (attachRafId) cancelAnimationFrame(attachRafId);
    };
  }, []);

  const onPressBackToTop = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <Stack flex={1}>
      <Tabs.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarOffset }}
        nestedScrollEnabled={platformEnv.isNativeAndroid}
        refreshControl={
          !platformEnv.isNativeAndroid ? (
            <PullToRefresh onRefresh={onHomePageRefresh} />
          ) : undefined
        }
      >
        <Stack
          ref={sentinelRef as any}
          width={0}
          height={0}
          pointerEvents="none"
        />
        <DeFiContainer />
      </Tabs.ScrollView>
      <BackToTopButton
        visible={backToTopVisible}
        onPress={onPressBackToTop}
        placement="left"
      />
    </Stack>
  );
}

function DeFiContainerScrollable() {
  if (platformEnv.isNative) {
    return <DeFiContainerScrollableNative />;
  }
  return <DeFiContainerScrollableWeb />;
}

function DeFiContainerWithProvider() {
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  return (
    <HomeTokenListProviderMirrorWrapper accountId={account?.id ?? ''}>
      <ProviderJotaiContextHistoryList>
        <ProviderJotaiContextDeFiList>
          <DeFiContainerScrollable />
        </ProviderJotaiContextDeFiList>
      </ProviderJotaiContextHistoryList>
    </HomeTokenListProviderMirrorWrapper>
  );
}
DeFiContainerWithProvider.displayName = 'DeFiContainerWithProvider';

export { DeFiContainerWithProvider };
