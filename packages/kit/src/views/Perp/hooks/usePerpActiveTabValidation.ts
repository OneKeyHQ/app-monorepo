import { useEffect, useMemo } from 'react';

import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

const FIXED_TAB_IDS = ['favorites', 'all', 'hip3'] as const;

/**
 * Validates the active tab and resets to 'all' if the currently selected
 * dynamic tab no longer exists (e.g., removed by the server).
 *
 * Waits until both dynamic tabs AND assets have loaded before validating
 * to avoid prematurely resetting a persisted dynamic tab during remount.
 */
function usePerpActiveTabValidation({
  activeTab,
  setActiveTab,
  assetsByDex,
  dynamicTabs,
  visibleDynamicTabs,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  assetsByDex: IPerpsUniverse[][] | undefined;
  dynamicTabs: IPerpDynamicTab[];
  visibleDynamicTabs: IPerpDynamicTab[];
}) {
  const hasAssetsLoaded = useMemo(
    () => (assetsByDex || []).some((assets) => assets.length > 0),
    [assetsByDex],
  );
  const hasDynamicTabs = dynamicTabs.length > 0;
  const visibleDynamicTabIds = useMemo(
    () => new Set(visibleDynamicTabs.map((tab) => tab.tabId)),
    [visibleDynamicTabs],
  );

  useEffect(() => {
    // Fixed tabs are always valid, no need to check further
    if ((FIXED_TAB_IDS as readonly string[]).includes(activeTab)) {
      return;
    }
    // Wait until assets have loaded before validating
    if (!hasAssetsLoaded) {
      return;
    }
    // Wait for dynamic tabs to load before validating dynamic tab IDs
    // (hasDynamicTabs being false means tabs haven't loaded yet)
    if (!hasDynamicTabs) {
      return;
    }
    if (!visibleDynamicTabIds.has(activeTab)) {
      setActiveTab('all');
    }
  }, [
    activeTab,
    hasDynamicTabs,
    hasAssetsLoaded,
    visibleDynamicTabIds,
    setActiveTab,
  ]);
}

export { usePerpActiveTabValidation, FIXED_TAB_IDS };
