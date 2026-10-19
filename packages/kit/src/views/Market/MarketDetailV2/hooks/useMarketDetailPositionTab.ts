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
export function useMarketDetailPositionTab({
  assetKey,
  isPortfolioSettled,
  hasPosition,
}: {
  assetKey: string | undefined;
  isPortfolioSettled: boolean;
  hasPosition: boolean;
}) {
  const [{ preferPosition }, setPositionTabPreference] =
    useMarketDetailPositionTabPersistAtom();
  const [showPosition, setShowPosition] = useState(preferPosition);
  const openedAssetKeyRef = useRef(assetKey);
  // The asset whose opening tab is settled, by the portfolio or by a tap.
  const resolvedAssetKeyRef = useRef<string | undefined>(undefined);
  // The asset on which the user picked a tab themselves.
  const [pickedAssetKey, setPickedAssetKey] = useState<string | undefined>();

  useEffect(() => {
    if (openedAssetKeyRef.current === assetKey) return;
    openedAssetKeyRef.current = assetKey;
    resolvedAssetKeyRef.current = undefined;
    setShowPosition(preferPosition);
  }, [assetKey, preferPosition]);

  useEffect(() => {
    if (resolvedAssetKeyRef.current === assetKey || !isPortfolioSettled) return;
    resolvedAssetKeyRef.current = assetKey;
    if (preferPosition && !hasPosition) {
      // Only this asset falls back; the remembered choice stays as it is.
      setShowPosition(false);
    }
  }, [assetKey, hasPosition, isPortfolioSettled, preferPosition]);

  const selectTab = useCallback(
    (isPositionTab: boolean) => {
      // A tap settles this asset's tab, so a late portfolio result never
      // overrides it.
      resolvedAssetKeyRef.current = assetKey;
      setPickedAssetKey(assetKey);
      setShowPosition(isPositionTab);
      setPositionTabPreference({ preferPosition: isPositionTab });
    },
    [assetKey, setPositionTabPreference],
  );

  // The position tab keeps its skeleton until the holdings are known, and
  // also while an automatically opened tab leaves an empty position, so the
  // empty state never flashes before the switch. A tab the user opens shows
  // the empty state as usual.
  const isPositionPending =
    !isPortfolioSettled ||
    (preferPosition && !hasPosition && pickedAssetKey !== assetKey);

  return { showPosition, selectTab, isPositionPending };
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
      programmaticTabRef.current = undefined;
      if (
        programmaticTab?.tabName === tabName &&
        Date.now() < programmaticTab.expiresAt
      ) {
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
