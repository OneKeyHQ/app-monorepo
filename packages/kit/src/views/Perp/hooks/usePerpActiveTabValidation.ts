import { useEffect, useMemo } from 'react';

import type { IPerpDynamicTab } from '@onekeyhq/kit-bg/src/services/ServiceWebviewPerp/ServiceWebviewPerp';
import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import { getPerpTokenSelectorFallbackTabId } from '../utils/tokenSelectorTabs';

/**
 * Validates the active tab and resets it if the currently selected tab no
 * longer exists in the server-driven token selector config.
 *
 * Waits until both server tabs AND assets have loaded before validating to
 * avoid prematurely resetting a persisted server tab during remount.
 */
function usePerpActiveTabValidation({
  activeTab,
  setActiveTab,
  assetsByDex,
  dynamicTabs,
  visibleTabs,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  assetsByDex: IPerpsUniverse[][] | undefined;
  // null = not loaded yet, [] = loaded but server returned no tabs
  dynamicTabs: IPerpDynamicTab[] | null;
  visibleTabs: IPerpDynamicTab[];
}) {
  const hasAssetsLoaded = useMemo(
    () => (assetsByDex || []).some((assets) => assets.length > 0),
    [assetsByDex],
  );
  const dynamicTabsLoaded = dynamicTabs !== null;
  const visibleTabIds = useMemo(
    () => new Set(visibleTabs.map((tab) => tab.tabId)),
    [visibleTabs],
  );
  const fallbackTabId = useMemo(
    () => getPerpTokenSelectorFallbackTabId(visibleTabs),
    [visibleTabs],
  );

  useEffect(() => {
    // Wait until both assets and dynamic tabs have loaded before validating
    if (!hasAssetsLoaded || !dynamicTabsLoaded) {
      return;
    }
    if (!visibleTabIds.has(activeTab)) {
      setActiveTab(fallbackTabId);
    }
  }, [
    activeTab,
    dynamicTabsLoaded,
    fallbackTabId,
    hasAssetsLoaded,
    visibleTabIds,
    setActiveTab,
  ]);
}

export { usePerpActiveTabValidation };
