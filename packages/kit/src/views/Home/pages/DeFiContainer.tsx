import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';

import {
  Image,
  SizableText,
  Skeleton,
  Stack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  ProviderJotaiContextDeFiList,
  useDeFiListProtocolMapAtom,
  useDeFiListProtocolsAtom,
  useDeFiListSlicedAtom,
  useDeFiListStateAtom,
} from '../../../states/jotai/contexts/deFiList';
import { ProviderJotaiContextHistoryList } from '../../../states/jotai/contexts/historyList';
import {
  buildProtocolDisplayInfo,
  collectDeFiImagePreloadSources,
} from '../../../utils/defiPositionUtils';
import useActiveTabDAppInfo from '../../DAppConnection/hooks/useActiveTabDAppInfo';
import {
  DeFiAllocationCard,
  DeFiListBlock,
  DeFiStickyPortal,
  type IProtocolHandle,
  ProtocolChipStrip,
  buildDeFiOverviewCells,
  useIsDeFiEnabled,
} from '../components/DeFiListBlock';
import { buildPortfolioStats } from '../components/DeFiListBlock/DeFiPortfolioStats';
import { formatPortfolioTotal } from '../components/DeFiListBlock/formatPortfolioTotal';
import { HomeScrollView } from '../components/HomeScrollView';
import { HomeStickyHeaderContext } from '../components/HomeStickyHeaderContext';
import { HomeTokenListProviderMirrorWrapper } from '../components/HomeTokenListProvider';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { RichBlock } from '../components/RichBlock/RichBlock';
import { SupportHub } from '../components/SupportHub';
import { Upgrade } from '../components/Upgrade';
import { STICKY_TOP_OFFSET } from '../types';

import {
  findActiveProtocolKey,
  findScrollableAncestorFromLocalNode,
  shouldQueueProtocolNavigation,
} from './defiDesktopStickyDom';

// Mirrors HomePageView's `homePageContentMaxWidthSx` so the DeFi tab content
// stays in horizontal alignment with the wallet header / tab bar / alerts.
// Page.Container is now layout="full" so the scroll container fills the
// viewport, and visual max-width is enforced one level down per content block.
const DEFI_CONTAINER_CONTENT_MAX_WIDTH = 1140;
const PROTOCOL_NAV_PENDING_TARGET_TIMEOUT_MS = 5000;
const DEFI_TAB_CONTENT_TEST_ID = 'home-defi-tab-content';

function getPreloadSourceKey(source: {
  uri?: string;
  resizeWidth?: number;
  width?: number;
  height?: number;
  optimize?: boolean;
}) {
  return [
    source.optimize === false ? 'raw' : 'optimized',
    source.uri,
    source.resizeWidth ?? '',
    source.width ?? '',
    source.height ?? '',
  ].join('|');
}

function scrollToAnchor(
  anchor: HTMLElement,
  offset: number,
  behavior: ScrollBehavior,
): { alreadyThere: boolean; targetY: number } {
  const scroller = findScrollableAncestorFromLocalNode(anchor);
  const anchorRect = anchor.getBoundingClientRect();

  if (!scroller) {
    const targetY = Math.max(0, anchorRect.top + globalThis.scrollY - offset);
    const alreadyThere = Math.abs(globalThis.scrollY - targetY) < 1;
    globalThis.scrollTo({ top: targetY, behavior });
    return { alreadyThere, targetY };
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
  const scrollTo =
    scroller.ownerDocument.defaultView?.Element.prototype.scrollTo.bind(
      scroller,
    ) ?? scroller.scrollTo.bind(scroller);
  const alreadyThere = Math.abs(scroller.scrollTop - targetY) < 1;
  scrollTo({ top: targetY, behavior });
  return { alreadyThere, targetY };
}

function DeFiContainer() {
  const media = useMedia();
  const reducedMotion = useReducedMotion();
  const intl = useIntl();

  const tableLayout = media.gtMd;

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;
  const isAllNetworks = Boolean(network?.isAllNetworks);
  const isDeFiEnabled = useIsDeFiEnabled(network?.id);

  const [{ protocols }] = useDeFiListProtocolsAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const [, setIsSliced] = useDeFiListSlicedAtom();
  const isOverviewLoading =
    !initialized || (isRefreshing && (protocols?.length ?? 0) === 0);

  // Warm the image cache for every protocol logo + every position
  // asset/debt/reward icon the expanded cards will eventually render.
  // The native image cache dedupes by URL internally, but we also track what we've
  // already requested so we don't rebuild the URL list when
  // protocols/protocolMap re-reference identically. Without the preload
  // pass, the first time a protocol card mounts (initial open, or after
  // a slice cut is removed) every Token inside flashes a skeleton while
  // the image fetches.
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const allSources = collectDeFiImagePreloadSources({
      protocols,
      protocolMap,
    });
    const fresh = allSources.filter(
      (source) => !preloadedUrlsRef.current.has(getPreloadSourceKey(source)),
    );
    if (fresh.length === 0) return;
    fresh.forEach((source) =>
      preloadedUrlsRef.current.add(getPreloadSourceKey(source)),
    );
    void Image.preloadImages(fresh);
  }, [protocols, protocolMap]);
  // Reset the dedup memo on account/network change. The native cache's own
  // cache survives the reset (we're only clearing our "already asked"
  // bookkeeping), so visited-but-now-irrelevant URLs don't accumulate
  // across long sessions of account/network switching.
  useEffect(() => {
    preloadedUrlsRef.current.clear();
  }, [account?.id, network?.id]);

  const triggerPinCheckRef = useRef<() => void>(() => {});
  // The inactive Home tab is hidden with `content-visibility: hidden`, which
  // keeps its last layout but stops updating it, so a pin-tracker pass while
  // the route is blurred (window resize, effect re-run) would read stale
  // rects and nothing would correct the result until the next user scroll
  // (same failure class as OK-63164 / OK-65383). Skip the pass while blurred
  // and re-run it once the route is focused again.
  const isHomeRouteFocusedRef = useRef(true);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const protocolRefs = useRef<Map<string, IProtocolHandle>>(new Map());
  // Read by pin tracker each scroll frame; ref avoids effect teardown on remeasure.
  const chipStripHeightRef = useRef<number>(0);
  // Currently sticky-tracked protocol key. Optimistically written by
  // handleChipPress so the strip's highlight matches click intent before
  // the smooth scroll lands.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  // 0..1 chip strip reveal progress (UI thread, written by pin tracker).
  const chipRevealShared = useSharedValue(0);
  // Last value written to chipRevealShared. Sub-pixel scroll noise produces
  // distinct floats every frame; an epsilon guard skips redundant writes
  // before they reach the UI thread's animated style + props consumers.
  const lastChipRevealRef = useRef(0);
  // Keep explicit navigation selected until the user scrolls again. Multiple
  // tail cards can share the same clamped scroll position.
  const pinLockTargetRef = useRef<string | null>(null);
  const pinLockScrollSettledRef = useRef(false);
  const pinLockSettledScrollTopRef = useRef<number | null>(null);
  const pinLockExpectedScrollTopRef = useRef<number | null>(null);
  const protocolNavigationGenerationRef = useRef(0);
  const pinLockSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Missing navigation targets are registration-driven: if the protocol card
  // is not mounted yet, expand the list and wait for its anchor before scroll.
  const pendingProtocolNavigationTargetRef = useRef<{
    key: string;
    protocol: IDeFiProtocol;
  } | null>(null);
  const pendingProtocolNavigationTargetTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearPendingProtocolNavigationTarget = useCallback(() => {
    pendingProtocolNavigationTargetRef.current = null;
    if (pendingProtocolNavigationTargetTimerRef.current) {
      clearTimeout(pendingProtocolNavigationTargetTimerRef.current);
      pendingProtocolNavigationTargetTimerRef.current = null;
    }
  }, []);

  const clearPinLockSafetyTimer = useCallback(() => {
    if (pinLockSafetyTimerRef.current) {
      clearTimeout(pinLockSafetyTimerRef.current);
      pinLockSafetyTimerRef.current = null;
    }
  }, []);

  const clearProtocolNavigationState = useCallback(() => {
    protocolNavigationGenerationRef.current += 1;
    clearPendingProtocolNavigationTarget();
    pinLockTargetRef.current = null;
    pinLockScrollSettledRef.current = false;
    pinLockSettledScrollTopRef.current = null;
    pinLockExpectedScrollTopRef.current = null;
    clearPinLockSafetyTimer();
  }, [clearPendingProtocolNavigationTarget, clearPinLockSafetyTimer]);

  useListenTabFocusState(ETabRoutes.Home, (isFocus) => {
    const wasFocused = isHomeRouteFocusedRef.current;
    isHomeRouteFocusedRef.current = isFocus;
    if (!isFocus && wasFocused) {
      clearProtocolNavigationState();
    } else if (isFocus && !wasFocused) {
      triggerPinCheckRef.current();
    }
  });

  const armPendingProtocolNavigationTargetTimer = useCallback(
    (safetyMs: number) => {
      if (pendingProtocolNavigationTargetTimerRef.current) {
        clearTimeout(pendingProtocolNavigationTargetTimerRef.current);
      }
      pendingProtocolNavigationTargetTimerRef.current = setTimeout(() => {
        clearPendingProtocolNavigationTarget();
        pinLockTargetRef.current = null;
        triggerPinCheckRef.current();
      }, safetyMs);
    },
    [clearPendingProtocolNavigationTarget],
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

  // Sorted full list (not the sliced view DeFiListBlock renders); the
  // chip strip is the global navigator and must surface every protocol.
  const filteredProtocols = useMemo(
    () =>
      buildDeFiOverviewCells(protocols, getNetWorth).map(
        (cell) => cell.protocol,
      ),
    [protocols, getNetWorth],
  );

  const stickyHeaderCtx = useContext(HomeStickyHeaderContext);
  const portalTarget = stickyHeaderCtx?.portalTarget ?? null;
  const isTabFocused = stickyHeaderCtx?.activeTabId === EHomeWalletTab.DeFi;
  // height (NOT bottom): scrollToAnchor's formula needs the offset in
  // scroller-content coordinates, which requires the post-scroll stuck-
  // state offset (height). Bottom would double-count scrollerRect.top
  // when the bar isn't yet stuck (top of page).
  const getLiveStickyOffset = useCallback(() => {
    const stickyHeight =
      stickyHeaderCtx?.stickyHost?.getBoundingClientRect().height ?? 0;
    const base = stickyHeight > 0 ? stickyHeight : STICKY_TOP_OFFSET;
    return base + chipStripHeightRef.current;
  }, [stickyHeaderCtx?.stickyHost]);

  // Strip height feeds the sticky line; remeasures bypass setState by
  // writing the ref, then poke the pin tracker to re-evaluate.
  const handleChipStripHeight = useCallback((h: number) => {
    if (Math.abs(chipStripHeightRef.current - h) < 0.5) return;
    chipStripHeightRef.current = h;
    triggerPinCheckRef.current();
  }, []);

  const scrollProtocolHandleIntoView = useCallback(
    (key: string, generation: number, handle: IProtocolHandle) => {
      handle.expand();

      if (platformEnv.isNative || typeof requestAnimationFrame !== 'function') {
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (
            pinLockTargetRef.current !== key ||
            protocolNavigationGenerationRef.current !== generation
          )
            return;
          const anchor = handle.getAnchor();
          if (!anchor) return;
          const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
          const { alreadyThere, targetY } = scrollToAnchor(
            anchor,
            getLiveStickyOffset(),
            behavior,
          );
          pinLockScrollSettledRef.current = alreadyThere;
          pinLockExpectedScrollTopRef.current = targetY;
          if (pinLockScrollSettledRef.current) {
            pinLockSettledScrollTopRef.current =
              scrollContainerRef.current?.scrollTop ?? null;
          }
          triggerPinCheckRef.current();
        });
      });
    },
    [getLiveStickyOffset, reducedMotion],
  );

  const navigateToProtocol = useCallback(
    (p: IDeFiProtocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });
      const handle = protocolRefs.current.get(key);
      const shouldQueueNavigation = shouldQueueProtocolNavigation({
        hasRegisteredHandle: Boolean(handle),
        isNative: Boolean(platformEnv.isNative),
        tableLayout,
      });

      if (!handle && !shouldQueueNavigation) {
        return;
      }

      clearPendingProtocolNavigationTarget();
      clearPinLockSafetyTimer();
      protocolNavigationGenerationRef.current += 1;
      const generation = protocolNavigationGenerationRef.current;
      pinLockTargetRef.current = key;
      pinLockScrollSettledRef.current = false;
      pinLockSettledScrollTopRef.current = null;
      pinLockExpectedScrollTopRef.current = null;
      setPinnedKey(key);
      if (handle) {
        scrollProtocolHandleIntoView(key, generation, handle);
        // A scroll can stop short of its destination after a layout change
        // or interruption. Do not leave the scroll spy locked indefinitely.
        pinLockSafetyTimerRef.current = setTimeout(() => {
          pinLockSafetyTimerRef.current = null;
          if (
            pinLockTargetRef.current !== key ||
            protocolNavigationGenerationRef.current !== generation
          )
            return;

          const anchor = protocolRefs.current.get(key)?.getAnchor();
          const scrollTop =
            scrollContainerRef.current?.scrollTop ?? globalThis.scrollY;
          const expectedScrollTop = pinLockExpectedScrollTopRef.current;
          if (
            anchor?.isConnected &&
            expectedScrollTop !== null &&
            Math.abs(scrollTop - expectedScrollTop) <= 1
          ) {
            pinLockScrollSettledRef.current = true;
            pinLockSettledScrollTopRef.current = scrollTop;
            return;
          }

          clearProtocolNavigationState();
          triggerPinCheckRef.current();
        }, 2000);
      } else {
        pendingProtocolNavigationTargetRef.current = { key, protocol: p };
        armPendingProtocolNavigationTargetTimer(
          PROTOCOL_NAV_PENDING_TARGET_TIMEOUT_MS,
        );
        setIsSliced(false);
      }
    },
    [
      armPendingProtocolNavigationTargetTimer,
      clearPendingProtocolNavigationTarget,
      clearPinLockSafetyTimer,
      clearProtocolNavigationState,
      scrollProtocolHandleIntoView,
      setIsSliced,
      tableLayout,
    ],
  );

  const registerProtocol = useCallback(
    (key: string, handle: IProtocolHandle | null) => {
      const currentHandle = protocolRefs.current.get(key) ?? null;
      const changed = currentHandle !== handle;

      if (handle) {
        protocolRefs.current.set(key, handle);
      } else {
        protocolRefs.current.delete(key);
        if (currentHandle && pinLockTargetRef.current === key) {
          clearProtocolNavigationState();
        }
      }

      if (changed && !platformEnv.isNative && tableLayout) {
        triggerPinCheckRef.current();
      }

      const pendingTarget = pendingProtocolNavigationTargetRef.current;
      if (
        handle &&
        pendingTarget?.key === key &&
        !platformEnv.isNative &&
        tableLayout
      ) {
        navigateToProtocol(pendingTarget.protocol);
      }
    },
    [clearProtocolNavigationState, navigateToProtocol, tableLayout],
  );

  const handlePageScrollIntent = useCallback(() => {
    if (
      pinLockTargetRef.current ||
      pendingProtocolNavigationTargetRef.current
    ) {
      clearProtocolNavigationState();
      triggerPinCheckRef.current();
    }
  }, [clearProtocolNavigationState]);

  const getPageScroller = useCallback(() => scrollContainerRef.current, []);

  const handleCollapseToProtocol = useCallback(
    (p: IDeFiProtocol) => {
      if (platformEnv.isNative || typeof requestAnimationFrame !== 'function') {
        return;
      }
      clearProtocolNavigationState();
      const generation = protocolNavigationGenerationRef.current;

      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (protocolNavigationGenerationRef.current !== generation) return;
          const anchor = protocolRefs.current.get(key)?.getAnchor();
          if (!anchor) return;
          const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
          scrollToAnchor(anchor, getLiveStickyOffset(), behavior);
          triggerPinCheckRef.current();
        });
      });
    },
    [clearProtocolNavigationState, getLiveStickyOffset, reducedMotion],
  );

  // Chip strip click handler uses the same protocol navigation path as
  // overview title cards, including pending registration for hidden cards.
  //
  // We pin the active chip optimistically + suppress the scroll-driven pin
  // tracker for the duration of the smooth scroll so the active state
  // doesn't flick through every chip the scroll passes over before
  // settling on the target.
  const handleChipPress = useCallback(
    (p: IDeFiProtocol) => {
      navigateToProtocol(p);
    },
    [navigateToProtocol],
  );

  // Protocol count alone isn't a sufficient gate: a wallet with 2+
  // protocols whose positions have all been closed reports
  // protocols.length >= 2 but portfolioStats.slices === [] (exposure
  // total is zero, so buildPortfolioStats short-circuits). Without
  // the slice check, the bar would render its empty-state strip while
  // the bento grid below shows N tiles all at $0 — two conflicting
  // statements about the same wallet. Require at least one slice so
  // the AllocationCard only appears when it has something to allocate.
  const shouldShowOverview =
    tableLayout &&
    (isOverviewLoading ||
      ((protocols?.length ?? 0) >= 2 && portfolioStats.slices.length > 0));

  // Chip strip mounts as soon as data has settled and there's enough to
  // navigate between. Single-protocol wallets get nothing (chip strip would
  // be a row of one — pure noise). Loading state suppresses too — skeleton
  // chips would just create flicker on cold start.
  const shouldShowChipStrip =
    tableLayout && !isOverviewLoading && filteredProtocols.length >= 2;

  // When the strip unmounts (data not ready, dropped below threshold),
  // reset the height ref so the next scrollToAnchor / pin tracker pass
  // uses an accurate sticky line again, and force the reveal shared value
  // back to 0 so the strip animates in cleanly the next time it mounts.
  useEffect(() => {
    if (!shouldShowChipStrip) {
      if (chipStripHeightRef.current !== 0) {
        chipStripHeightRef.current = 0;
        triggerPinCheckRef.current();
      }
      chipRevealShared.value = 0;
      lastChipRevealRef.current = 0;
    }
  }, [shouldShowChipStrip, chipRevealShared]);

  useEffect(() => {
    if (platformEnv.isNative || !tableLayout) {
      return;
    }

    let raf = 0;
    let attachedScroller: HTMLElement | null = null;
    let schedule = () => {};
    const scrollOpts: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        handlePageScrollIntent();
      }
    };
    const handleScroll = (event: Event) => {
      if (
        attachedScroller &&
        event.target === attachedScroller &&
        pinLockTargetRef.current &&
        pinLockScrollSettledRef.current &&
        pinLockSettledScrollTopRef.current !== null &&
        Math.abs(
          attachedScroller.scrollTop - pinLockSettledScrollTopRef.current,
        ) > 1
      ) {
        clearProtocolNavigationState();
      }
      schedule();
    };
    const handleScrollEnd = () => {
      if (
        pinLockTargetRef.current &&
        attachedScroller &&
        pinLockExpectedScrollTopRef.current !== null &&
        Math.abs(
          attachedScroller.scrollTop - pinLockExpectedScrollTopRef.current,
        ) <= 1
      ) {
        pinLockScrollSettledRef.current = true;
        pinLockSettledScrollTopRef.current = attachedScroller.scrollTop;
      }
    };
    const handleScrollbarPointerDown = (event: PointerEvent) => {
      if (!attachedScroller || event.target !== attachedScroller) return;
      const rect = attachedScroller.getBoundingClientRect();
      if (event.clientX >= rect.right - 16) handlePageScrollIntent();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isHomeRouteFocusedRef.current || !isTabFocused) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.closest(
            'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]',
          ))
      ) {
        return;
      }
      if (target instanceof HTMLElement) {
        if (
          event.key === ' ' &&
          target.closest(
            'button, a[href], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [role="tab"]',
          )
        )
          return;
        if (
          ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) &&
          target.closest(
            '[role="slider"], [role="spinbutton"], [role="listbox"], [role="combobox"], [role="menu"], [role="tablist"], [role="tree"], [role="grid"]',
          )
        )
          return;
      }
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'PageUp',
          'PageDown',
          'Home',
          'End',
          ' ',
        ].includes(event.key)
      ) {
        handlePageScrollIntent();
      }
    };
    const handleResize = () => {
      clearProtocolNavigationState();
      schedule();
    };

    const resolveOriginNode = () => {
      // Use any live protocol anchor as the origin to locate the page scroller.
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
    schedule = () => {
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
        attachedScroller.removeEventListener(
          'scroll',
          handleScroll,
          scrollOpts,
        );
        attachedScroller.removeEventListener('scrollend', handleScrollEnd);
        attachedScroller.removeEventListener('wheel', handleWheel, scrollOpts);
        attachedScroller.removeEventListener(
          'touchmove',
          handlePageScrollIntent,
          scrollOpts,
        );
        attachedScroller.removeEventListener(
          'pointerdown',
          handleScrollbarPointerDown,
          scrollOpts,
        );
      }

      attachedScroller = nextScroller;
      scrollContainerRef.current = nextScroller;

      if (attachedScroller) {
        attachedScroller.addEventListener('scroll', handleScroll, scrollOpts);
        attachedScroller.addEventListener('scrollend', handleScrollEnd);
        attachedScroller.addEventListener('wheel', handleWheel, scrollOpts);
        attachedScroller.addEventListener(
          'touchmove',
          handlePageScrollIntent,
          scrollOpts,
        );
        attachedScroller.addEventListener(
          'pointerdown',
          handleScrollbarPointerDown,
          scrollOpts,
        );
      }
    };

    check = () => {
      if (!isHomeRouteFocusedRef.current) {
        return;
      }
      syncScrollerSubscription();

      const stickyHostRect =
        stickyHeaderCtx?.stickyHost?.getBoundingClientRect() ?? null;
      // bottom (NOT height): we compare against anchor.getBoundingClientRect().top,
      // which is in viewport coordinates — bottom carries scrollerRect.top
      // implicitly when the bar is stuck. Using height would miss that
      // offset and the just-clicked protocol would fail the active filter.
      const stickyBottomY =
        stickyHostRect && stickyHostRect.bottom > 0
          ? stickyHostRect.bottom
          : STICKY_TOP_OFFSET;
      const nextStickyLine = stickyBottomY + chipStripHeightRef.current;

      const disconnectedKeys: string[] = [];
      const candidates: Array<{
        key: string;
        top: number;
        bottom: number;
        width: number;
      }> = [];
      // Topmost (smallest top) protocol anchor. Drives the
      // chipRevealShared progress below.
      let minAnchorTop = Number.POSITIVE_INFINITY;

      for (const [key, handle] of protocolRefs.current) {
        const anchor = handle.getAnchor();
        if (!anchor?.isConnected) {
          disconnectedKeys.push(key);
          // eslint-disable-next-line no-continue
          continue;
        }
        const rect = anchor.getBoundingClientRect();
        if (rect.top < minAnchorTop) minAnchorTop = rect.top;
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

      // Scroll-bound reveal: progress 1.0 lands exactly when the first
      // protocol's top reaches the sticky bar's bottom; progress 0.0 is
      // chipStripHeight before that. So the strip is already fully
      // present the moment the title slides under the bar.
      const revealRange = chipStripHeightRef.current;
      const revealProgress = (() => {
        if (minAnchorTop === Number.POSITIVE_INFINITY) return 0;
        if (revealRange > 0) {
          const distance = stickyBottomY + revealRange - minAnchorTop;
          return Math.max(0, Math.min(1, distance / revealRange));
        }
        // Strip not yet measured: degrade to a binary crossing flag so the
        // active chip drives correctly on the very first paint.
        return minAnchorTop <= stickyBottomY ? 1 : 0;
      })();
      // Epsilon guard: sub-pixel scroll noise produces fresh distinct
      // floats every frame; same-value writes still notify the UI thread
      // before Reanimated's internal dedupe kicks in. The `settled` term
      // forces a snap to 0/1 so we don't sit at e.g. 0.998 once scroll
      // has stopped just past the threshold.
      const last = lastChipRevealRef.current;
      const settled = revealProgress === 0 || revealProgress === 1;
      const diffBig = Math.abs(last - revealProgress) > 1 / 256;
      if ((settled || diffBig) && last !== revealProgress) {
        lastChipRevealRef.current = revealProgress;
        chipRevealShared.value = revealProgress;
      }

      const nextKey =
        (isTabFocused
          ? findActiveProtocolKey({
              stickyLine: nextStickyLine,
              candidates,
              scrollMetrics: attachedScroller
                ? {
                    scrollTop: attachedScroller.scrollTop,
                    maxScroll:
                      attachedScroller.scrollHeight -
                      attachedScroller.clientHeight,
                    viewportBottom:
                      attachedScroller.getBoundingClientRect().bottom,
                  }
                : undefined,
            })
          : null) ?? null;

      if (pinLockTargetRef.current !== null) {
        return;
      }

      setPinnedKey((prev) => (prev === nextKey ? prev : nextKey));
    };

    syncScrollerSubscription();
    globalThis.addEventListener('resize', handleResize);
    globalThis.addEventListener('keydown', handleKeyDown, true);
    triggerPinCheckRef.current = schedule;
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (attachedScroller) {
        attachedScroller.removeEventListener(
          'scroll',
          handleScroll,
          scrollOpts,
        );
        attachedScroller.removeEventListener('scrollend', handleScrollEnd);
        attachedScroller.removeEventListener('wheel', handleWheel, scrollOpts);
        attachedScroller.removeEventListener(
          'touchmove',
          handlePageScrollIntent,
          scrollOpts,
        );
        attachedScroller.removeEventListener(
          'pointerdown',
          handleScrollbarPointerDown,
          scrollOpts,
        );
      }
      scrollContainerRef.current = null;
      globalThis.removeEventListener('resize', handleResize);
      globalThis.removeEventListener('keydown', handleKeyDown, true);
      triggerPinCheckRef.current = () => {};
    };
  }, [
    chipRevealShared,
    clearProtocolNavigationState,
    handlePageScrollIntent,
    isTabFocused,
    stickyHeaderCtx?.stickyHost,
    tableLayout,
  ]);

  useEffect(() => {
    clearProtocolNavigationState();
    triggerPinCheckRef.current();
  }, [account?.id, network?.id, clearProtocolNavigationState]);

  useEffect(() => {
    if (isTabFocused) {
      return;
    }
    setPinnedKey(null);
    chipRevealShared.value = 0;
    lastChipRevealRef.current = 0;
    // Drop any in-flight protocol navigation so it can't fire on a
    // stale pinnedKey after the user has navigated away.
    clearProtocolNavigationState();
  }, [isTabFocused, chipRevealShared, clearProtocolNavigationState]);

  // Protocol navigation timers survive effect re-runs (they're owned by
  // click handlers), so the unmount path needs its own cleanup.
  useEffect(
    () => () => {
      clearProtocolNavigationState();
    },
    [clearProtocolNavigationState],
  );

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
      clearProtocolNavigationState();
      setPinnedKey(null);
    }
  }, [pinnedKey, protocols, clearProtocolNavigationState]);

  if (tableLayout) {
    if (!isDeFiEnabled) {
      return null;
    }

    return (
      <>
        <YStack
          testID={DEFI_TAB_CONTENT_TEST_ID}
          pt="$4"
          pb="$8"
          width="100%"
          $gtMd={{
            maxWidth: DEFI_CONTAINER_CONTENT_MAX_WIDTH,
            mx: 'auto',
          }}
        >
          <RichBlock
            withTitleSeparator
            title={intl.formatMessage({
              id: ETranslations.earn_portfolio_title,
            })}
            subTitle={
              isOverviewLoading ? (
                // Match DeFiListBlock's heading skeleton preset so the
                // $headingXl total has one canonical loading shape across
                // both surfaces (DeFi tab here, mobile section there).
                // w=120 widens the preset's default 103 px to better
                // approximate a typical "$XX,XXX.XX" measurement.
                <Skeleton.HeadingXl w={120} />
              ) : (
                <SizableText size="$headingXl" color="$textSubdued">
                  {formatPortfolioTotal(
                    portfolioStats.total,
                    currencySymbol,
                    settingsValue.hideValue,
                  )}
                </SizableText>
              )
            }
            // pb=0 cancels RichBlockHeader's own py="$3" bottom padding so the
            // gap to the next block reads as the explicit mt below, not the
            // header's internal padding stacked on top of it.
            headerContainerProps={{ px: '$pagePadding', pb: 0 }}
            content={null}
            plainContentContainer
          />
          {shouldShowOverview ? (
            <YStack px="$pagePadding" mt="$5">
              <DeFiAllocationCard
                stats={portfolioStats}
                protocols={protocols}
                protocolMap={protocolMap}
                isLoading={isOverviewLoading}
                getNetWorth={getNetWorth}
                onPressProtocol={navigateToProtocol}
                isAllNetworks={isAllNetworks}
              />
            </YStack>
          ) : null}
          <YStack mt="$8" gap="$8">
            <DeFiListBlock
              tableLayout
              hideInternalTitle
              isDeFiEnabled={isDeFiEnabled}
              registerProtocol={registerProtocol}
              onCollapseToProtocol={handleCollapseToProtocol}
            />
            <Upgrade />
            <SupportHub />
          </YStack>
          {addPaddingOnListFooter ? <Stack h="$16" /> : null}
        </YStack>
        {portalTarget && isTabFocused && shouldShowChipStrip ? (
          <DeFiStickyPortal target={portalTarget}>
            {/* Always mounted while data is present so onLayout reports a
                stable height; reveal is opacity-driven via chipRevealShared. */}
            <ProtocolChipStrip
              protocols={filteredProtocols}
              protocolMap={protocolMap}
              isAllNetworks={isAllNetworks}
              activeKey={pinnedKey}
              onPressChip={handleChipPress}
              onPageScrollIntent={handlePageScrollIntent}
              getPageScroller={getPageScroller}
              onHeightChange={handleChipStripHeight}
              revealProgress={chipRevealShared}
            />
          </DeFiStickyPortal>
        ) : null}
      </>
    );
  }

  return (
    <YStack testID={DEFI_TAB_CONTENT_TEST_ID} gap="$6" pb="$5">
      <DeFiListBlock />
      <Upgrade />
      <SupportHub />
      {addPaddingOnListFooter ? <Stack h="$16" /> : null}
    </YStack>
  );
}

function DeFiContainerScrollable() {
  const tabBarOffset = useScrollContentTabBarOffset();

  return (
    <Stack flex={1}>
      <HomeScrollView
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
      </HomeScrollView>
    </Stack>
  );
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
