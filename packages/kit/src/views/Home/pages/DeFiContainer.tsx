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
import {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import {
  Image,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  YStack,
  useCurrentTabScrollY,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { useTabsContext } from '@onekeyhq/components/src/composite/Tabs/context';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type { IDeFiProtocol } from '@onekeyhq/shared/types/defi';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';
import type { WorkletFn } from '@onekeyhq/shared/types/worklet';

import { BackToTopButton } from '../../../components/BackToTopButton';
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
  collectDeFiImageUrls,
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
  shouldReleasePinLock,
} from './defiDesktopStickyDom';

// Scroll depth beyond which back-to-top may reveal; deep enough to be past
// the initial fold, shallow enough to not require a full viewport of scroll.
const BACK_TO_TOP_NEAR_TOP_PX = 200;

// Mirrors HomePageView's `homePageContentMaxWidthSx` so the DeFi tab content
// stays in horizontal alignment with the wallet header / tab bar / alerts.
// Page.Container is now layout="full" so the scroll container fills the
// viewport, and visual max-width is enforced one level down per content block.
const DEFI_CONTAINER_CONTENT_MAX_WIDTH = 1140;
const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
const CHIP_NAV_PENDING_TARGET_TIMEOUT_MS = 5000;

// Industry pattern: reveal on any upward scroll past the initial fold; hide
// on downward scroll or when back near the top. rAF / animated-reaction
// throttles already absorb wheel jitter, so no extra dead zone. Returns
// `previous` when direction is neutral so callers can dedup by identity.
// Called from a Reanimated worklet (useAnimatedReaction below). The
// 'worklet'; directive is REQUIRED — Reanimated's babel plugin does not
// auto-worklet top-level named function declarations, so without it the UI
// thread crashes with "Object is not a function".
const decideBackToTopVisible: WorkletFn<
  (current: number, last: number, previous: boolean) => boolean
> = (current, last, previous) => {
  'worklet';
  if (current <= BACK_TO_TOP_NEAR_TOP_PX) return false;
  if (current < last) return true;
  if (current > last) return false;
  return previous;
};

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
  // expo-image dedupes by URL internally, but we also track what we've
  // already requested so we don't rebuild the URL list when
  // protocols/protocolMap re-reference identically. Without the preload
  // pass, the first time a protocol card mounts (initial open, or after
  // a slice cut is removed) every Token inside flashes a skeleton while
  // the image fetches.
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const allUrls = collectDeFiImageUrls({ protocols, protocolMap });
    const fresh = allUrls.filter((u) => !preloadedUrlsRef.current.has(u));
    if (fresh.length === 0) return;
    fresh.forEach((u) => preloadedUrlsRef.current.add(u));
    void Image.preloadImages(fresh.map((uri) => ({ uri })));
  }, [protocols, protocolMap]);
  // Reset the dedup memo on account/network change. expo-image's own
  // cache survives the reset (we're only clearing our "already asked"
  // bookkeeping), so visited-but-now-irrelevant URLs don't accumulate
  // across long sessions of account/network switching.
  useEffect(() => {
    preloadedUrlsRef.current.clear();
  }, [account?.id, network?.id]);

  const triggerPinCheckRef = useRef<() => void>(() => {});
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
  // Chip-click pin lock. Single source of truth: a non-null target means
  // the lock is engaged. The pin tracker condition-releases the lock
  // (see shouldReleasePinLock) the moment its computed candidate catches
  // up to the click target; the safety timer is a fallback for cases
  // where the target is never reached (unreachable, layout collapse).
  const pinLockTargetRef = useRef<string | null>(null);
  const pinLockSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Hidden chip targets are registration-driven: clicking a protocol hidden
  // behind the slice cut first expands the list, then waits for that protocol
  // to register its anchor before attempting expand + scroll.
  const pendingChipTargetRef = useRef<{
    key: string;
    protocol: IDeFiProtocol;
  } | null>(null);
  const pendingChipTargetTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearPendingChipTarget = useCallback(() => {
    pendingChipTargetRef.current = null;
    if (pendingChipTargetTimerRef.current) {
      clearTimeout(pendingChipTargetTimerRef.current);
      pendingChipTargetTimerRef.current = null;
    }
  }, []);

  const clearPinLockSafetyTimer = useCallback(() => {
    if (pinLockSafetyTimerRef.current) {
      clearTimeout(pinLockSafetyTimerRef.current);
      pinLockSafetyTimerRef.current = null;
    }
  }, []);

  const clearChipNavigationState = useCallback(() => {
    clearPendingChipTarget();
    pinLockTargetRef.current = null;
    clearPinLockSafetyTimer();
  }, [clearPendingChipTarget, clearPinLockSafetyTimer]);

  const armPendingChipTargetTimer = useCallback(
    (safetyMs: number) => {
      if (pendingChipTargetTimerRef.current) {
        clearTimeout(pendingChipTargetTimerRef.current);
      }
      pendingChipTargetTimerRef.current = setTimeout(() => {
        clearPendingChipTarget();
        triggerPinCheckRef.current();
      }, safetyMs);
    },
    [clearPendingChipTarget],
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
          // Edge case: if the target was already at the sticky line, the
          // scrollTo above is a no-op and no scroll events fire — which
          // would leave any chip-click pin lock waiting on the safety
          // timer. A manual ping lets the pin tracker observe the
          // already-landed state and release the lock within a frame.
          triggerPinCheckRef.current();
        });
      });
    },
    [getLiveStickyOffset, reducedMotion],
  );

  const lockActiveAndScrollToProtocol = useCallback(
    (p: IDeFiProtocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });

      clearPendingChipTarget();
      clearPinLockSafetyTimer();
      pinLockTargetRef.current = key;
      setPinnedKey(key);
      handleTilePress(p);
      // Fallback for the rare case where the scroll never settles on
      // the target (target unreachable, layout collapse). Generous so
      // it almost never fires — condition-release is the normal path.
      const safetyMs = reducedMotion ? 250 : 2000;
      pinLockSafetyTimerRef.current = setTimeout(() => {
        pinLockSafetyTimerRef.current = null;
        pinLockTargetRef.current = null;
        triggerPinCheckRef.current();
      }, safetyMs);
    },
    [
      clearPendingChipTarget,
      clearPinLockSafetyTimer,
      handleTilePress,
      reducedMotion,
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
      }

      if (changed && !platformEnv.isNative && tableLayout) {
        triggerPinCheckRef.current();
      }

      const pendingTarget = pendingChipTargetRef.current;
      if (
        handle &&
        pendingTarget?.key === key &&
        !platformEnv.isNative &&
        tableLayout
      ) {
        lockActiveAndScrollToProtocol(pendingTarget.protocol);
      }
    },
    [lockActiveAndScrollToProtocol, tableLayout],
  );

  const handleCollapseToProtocol = useCallback(
    (p: IDeFiProtocol) => {
      if (platformEnv.isNative || typeof requestAnimationFrame !== 'function') {
        return;
      }

      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const anchor = protocolRefs.current.get(key)?.getAnchor();
          if (!anchor) return;
          const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth';
          scrollToAnchor(anchor, getLiveStickyOffset(), behavior);
          triggerPinCheckRef.current();
        });
      });
    },
    [getLiveStickyOffset, reducedMotion],
  );

  // Chip strip click handler: same destination as handleTilePress (and
  // shares the scroll/expand machinery), but also expands the list when
  // the target protocol is currently hidden behind the "Show more" cut so
  // a chip is never a dead button.
  //
  // We pin the active chip optimistically + suppress the scroll-driven pin
  // tracker for the duration of the smooth scroll so the active state
  // doesn't flick through every chip the scroll passes over before
  // settling on the target.
  const handleChipPress = useCallback(
    (p: IDeFiProtocol) => {
      const key = defiUtils.buildProtocolMapKey({
        protocol: p.protocol,
        networkId: p.networkId,
      });

      if (protocolRefs.current.has(key)) {
        lockActiveAndScrollToProtocol(p);
        return;
      }

      // Hidden behind the slice cut: unslice and let registerProtocol drive
      // expand + scroll when the target anchor is actually mounted.
      pendingChipTargetRef.current = { key, protocol: p };
      armPendingChipTargetTimer(CHIP_NAV_PENDING_TARGET_TIMEOUT_MS);
      setIsSliced(false);
    },
    [armPendingChipTargetTimer, lockActiveAndScrollToProtocol, setIsSliced],
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
    const scrollOpts: AddEventListenerOptions = {
      capture: true,
      passive: true,
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
            })
          : null) ?? null;

      // Chip-click pin lock: hold pinnedKey at the click target while a
      // chip-click smooth scroll is in flight. Release once the pin
      // tracker's natural candidate catches up (see shouldReleasePinLock
      // for why a time-based release was wrong).
      const lockTarget = pinLockTargetRef.current;
      if (lockTarget !== null) {
        if (shouldReleasePinLock({ candidate: nextKey, target: lockTarget })) {
          pinLockTargetRef.current = null;
          if (pinLockSafetyTimerRef.current) {
            clearTimeout(pinLockSafetyTimerRef.current);
            pinLockSafetyTimerRef.current = null;
          }
        }
        return;
      }

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
    chipRevealShared,
    isTabFocused,
    stickyHeaderCtx?.stickyHost,
    tableLayout,
  ]);

  useEffect(() => {
    if (isTabFocused) {
      return;
    }
    setPinnedKey(null);
    chipRevealShared.value = 0;
    lastChipRevealRef.current = 0;
    // Drop any in-flight chip-click navigation so it can't fire on a
    // stale pinnedKey after the user has navigated away.
    clearChipNavigationState();
  }, [isTabFocused, chipRevealShared, clearChipNavigationState]);

  // Chip navigation timers survive effect re-runs (they're owned by
  // handleChipPress), so the unmount path needs its own cleanup.
  useEffect(
    () => () => {
      clearChipNavigationState();
    },
    [clearChipNavigationState],
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
      setPinnedKey(null);
    }
  }, [pinnedKey, protocols]);

  if (tableLayout) {
    if (!isDeFiEnabled) {
      return null;
    }

    return (
      <>
        <YStack
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
                <SizableText
                  size="$headingXl"
                  color="$textSubdued"
                  fontVariant={TABULAR_NUMS}
                >
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
                onPressProtocol={handleTilePress}
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
              activeKey={pinnedKey}
              onPressChip={handleChipPress}
              onHeightChange={handleChipStripHeight}
              revealProgress={chipRevealShared}
            />
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
