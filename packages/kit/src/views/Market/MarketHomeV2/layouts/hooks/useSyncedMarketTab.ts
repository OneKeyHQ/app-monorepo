import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';

export function useSyncedMarketTab(
  targetTabName: string,
  tabsRef?: RefObject<ITabContainerRef | null>,
) {
  const internalTabsRef = useRef<ITabContainerRef | null>(null);
  const resolvedTabsRef = tabsRef ?? internalTabsRef;
  const [activeTabName, setActiveTabName] = useState(targetTabName);

  useEffect(() => {
    setActiveTabName(targetTabName);
    const currentTabName = resolvedTabsRef.current?.getFocusedTab();
    if (currentTabName && currentTabName !== targetTabName) {
      resolvedTabsRef.current?.jumpToTab(targetTabName);
    }
  }, [resolvedTabsRef, targetTabName]);

  return {
    activeTabName,
    setActiveTabName,
    tabsRef: resolvedTabsRef,
  };
}
