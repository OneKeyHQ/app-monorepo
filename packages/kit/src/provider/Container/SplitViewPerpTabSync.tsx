import { useEffect } from 'react';

import {
  rootNavigationRef,
  tabletMainViewNavigationRef,
  useIsSplitView,
} from '@onekeyhq/components';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

// OK-54993: when the iPad / foldable dual-pane layout is active and the user
// (or any code path) moves the MAIN pane to the Perp tab, mirror that switch
// onto the SUB pane navigator so the right pane's Perp route mounts and
// renders the inline K-line chart (see Perp.tsx's `splitViewType === SUB`
// branch). Without this sync the SUB navigator stays on whatever tab it was
// last on and that tab's `<TabletHomeContainer>` falls through to the
// OneKey-logo placeholder.
//
// We listen at the navigation-ref level (not via React context) so the sync
// covers every entry point that lands MAIN on Perp:
//   - tab bar tap (goes through `switchTab`, which mutates MAIN's state)
//   - direct `tabletMainViewNavigationRef.navigate(...)` calls
//   - deep links / push notifications / event-bus driven navigation
//   - cold-start initial route
//
// Plain `navigate` (no `pop: true`) is intentional: we only swap the tab
// underneath any modal/overlay the user pushed on SUB instead of yanking it
// away.

function getActiveTabName(ref: typeof rootNavigationRef): string | undefined {
  const state = ref.current?.getRootState();
  if (!state) return undefined;
  const main = state.routes?.find((r) => r.name === ERootRoutes.Main);
  const idx = main?.state?.index ?? 0;
  return main?.state?.routes?.[idx]?.name;
}

function syncSubPaneToPerpIfNeeded() {
  if (getActiveTabName(tabletMainViewNavigationRef) !== ETabRoutes.Perp) {
    return;
  }
  if (getActiveTabName(rootNavigationRef) === ETabRoutes.Perp) {
    return;
  }
  rootNavigationRef.current?.navigate(ERootRoutes.Main as any, {
    screen: ETabRoutes.Perp,
  });
}

const REF_POLL_INTERVAL_MS = 200;

export function SplitViewPerpTabSync() {
  const isLandscape = useIsSplitView();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      if (cancelled) return;
      const ref = tabletMainViewNavigationRef.current;
      // The MAIN navigator mounts asynchronously after Container renders; poll
      // until the ref is wired up, then subscribe.
      if (!ref) {
        retryTimer = setTimeout(attach, REF_POLL_INTERVAL_MS);
        return;
      }
      syncSubPaneToPerpIfNeeded();
      // React Navigation's NavigationContainerRef doesn't type 'state' as a
      // public event, but the underlying ref forwards it from the container.
      unsubscribe = ref.addListener?.(
        'state' as any,
        syncSubPaneToPerpIfNeeded,
      );
    };
    attach();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe?.();
    };
  }, []);

  // Rotation fallback: when the user rotates portrait → landscape while MAIN
  // is already on Perp, MAIN's navigator state doesn't change, so the state
  // listener doesn't fire. Run an explicit sync on every landscape
  // transition.
  useEffect(() => {
    if (isLandscape) {
      syncSubPaneToPerpIfNeeded();
    }
  }, [isLandscape]);

  return null;
}
