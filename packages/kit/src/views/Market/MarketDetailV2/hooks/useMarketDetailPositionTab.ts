import { useCallback, useEffect, useRef, useState } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';
import { useMarketDetailPositionTabPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// A jump made here can come back through onTabChange; it is not a user choice.
const PROGRAMMATIC_TAB_CHANGE_WINDOW_MS = 1000;

/**
 * Opens every market detail page on My position when that was the last tab
 * picked on any detail page, and on the page's own default tab otherwise.
 * A remembered position tab stays up while the portfolio loads and falls back
 * to the default tab once this asset turns out to have no position. Pages that
 * switch assets in place run the check again for each asset.
 */
interface IPositionTabVisit {
  assetKey: string | undefined;
  showPosition: boolean;
  // The opening tab is settled, by the portfolio or by a tap.
  isResolved: boolean;
  // The portfolio closed an automatically opened position tab.
  hasFallenBack: boolean;
  // The user picked a tab during this visit.
  isPicked: boolean;
}

function createVisit(
  assetKey: string | undefined,
  preferPosition: boolean,
): IPositionTabVisit {
  return {
    assetKey,
    showPosition: preferPosition,
    isResolved: false,
    hasFallenBack: false,
    isPicked: false,
  };
}

export function useMarketDetailPositionTab({
  assetKey,
  isPortfolioSettled,
  hasPosition,
}: {
  // The asset and account the holdings belong to. Every change starts a new
  // visit, so a page that switches assets or accounts in place decides again.
  assetKey: string | undefined;
  isPortfolioSettled: boolean;
  hasPosition: boolean;
}) {
  const [{ preferPosition }, setPositionTabPreference] =
    useMarketDetailPositionTabPersistAtom();
  const [storedVisit, setVisit] = useState(() =>
    createVisit(assetKey, preferPosition),
  );
  // Reset during render rather than in an effect, so no render pairs the new
  // asset with the previous visit.
  let visit = storedVisit;
  if (visit.assetKey !== assetKey) {
    visit = createVisit(assetKey, preferPosition);
    setVisit(visit);
  }

  useEffect(() => {
    if (!isPortfolioSettled) return;
    setVisit((current) => {
      if (current.assetKey !== assetKey || current.isResolved) return current;
      // Only this visit falls back; the remembered choice stays as it is.
      const hasFallenBack = current.showPosition && !hasPosition;
      return {
        ...current,
        isResolved: true,
        hasFallenBack,
        showPosition: hasFallenBack ? false : current.showPosition,
      };
    });
  }, [assetKey, hasPosition, isPortfolioSettled]);

  const selectTab = useCallback(
    (isPositionTab: boolean) => {
      // A tap settles this visit, so a late portfolio result never overrides
      // it.
      setVisit((current) => ({
        ...(current.assetKey === assetKey
          ? current
          : createVisit(assetKey, isPositionTab)),
        showPosition: isPositionTab,
        isResolved: true,
        isPicked: true,
      }));
      setPositionTabPreference({ preferPosition: isPositionTab });
    },
    [assetKey, setPositionTabPreference],
  );

  // The position tab shows a skeleton until the holdings are known. An
  // automatically opened tab that is about to close, or has just closed, keeps
  // it too, so "No data" never flashes during the switch. Once settled with a
  // position, holdings that later empty out show the empty state as usual,
  // as does any tab the user opens.
  const willFallBack = visit.showPosition && !hasPosition;
  const isPositionPending =
    !isPortfolioSettled ||
    (!visit.isPicked &&
      (visit.isResolved ? visit.hasFallenBack : willFallBack));

  return { showPosition: visit.showPosition, selectTab, isPositionPending };
}

/**
 * Drives a Tabs.Container from useMarketDetailPositionTab: opens on the
 * position tab, jumps away when the asset has no position, and records the
 * tabs the user picks.
 */
export function useMarketDetailPositionTabContainer({
  assetKey,
  isPortfolioSettled,
  hasPosition,
  positionTabName,
  defaultTabName,
}: {
  assetKey: string | undefined;
  isPortfolioSettled: boolean;
  hasPosition: boolean;
  positionTabName: string;
  defaultTabName: string | undefined;
}) {
  const { showPosition, selectTab, isPositionPending } =
    useMarketDetailPositionTab({
      assetKey,
      isPortfolioSettled,
      hasPosition,
    });
  const tabsRef = useRef<ITabContainerRef | null>(null);
  const showPositionRef = useRef(showPosition);
  const isUserChangeRef = useRef(false);
  const programmaticTabRef = useRef<
    { tabName: string; expiresAt: number } | undefined
  >(undefined);

  useEffect(() => {
    if (showPositionRef.current === showPosition) return;
    showPositionRef.current = showPosition;
    if (isUserChangeRef.current) {
      // The container already shows the tab the user picked.
      isUserChangeRef.current = false;
      return;
    }
    const targetTabName = showPosition ? positionTabName : defaultTabName;
    if (!targetTabName) return;
    programmaticTabRef.current = {
      tabName: targetTabName,
      expiresAt: Date.now() + PROGRAMMATIC_TAB_CHANGE_WINDOW_MS,
    };
    tabsRef.current?.jumpToTab(targetTabName);
  }, [defaultTabName, positionTabName, showPosition]);

  const handleTabChange = useCallback(
    ({ tabName }: { tabName: string }) => {
      const programmaticTab = programmaticTabRef.current;
      if (programmaticTab && Date.now() >= programmaticTab.expiresAt) {
        programmaticTabRef.current = undefined;
      } else if (programmaticTab?.tabName === tabName) {
        // Only the jump's own event is swallowed. A user tap that lands first
        // keeps the guard, so the jump's late event still is not recorded.
        programmaticTabRef.current = undefined;
        return;
      }
      const isPositionTab = tabName === positionTabName;
      if (isPositionTab !== showPositionRef.current) {
        isUserChangeRef.current = true;
      }
      selectTab(isPositionTab);
    },
    [positionTabName, selectTab],
  );

  return {
    tabsRef,
    // Read on every mount, so a container remounted for a new tab set keeps
    // the tab this asset should be on.
    initialTabName: showPosition ? positionTabName : undefined,
    handleTabChange,
    // When the position tab is itself the default there is nothing to switch
    // to, so a settled empty position shows its empty state.
    isPositionPending:
      isPositionPending &&
      (!isPortfolioSettled || defaultTabName !== positionTabName),
  };
}
