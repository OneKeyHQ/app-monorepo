import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';

export function useSyncedMarketTab(
  targetTabName: string,
  tabsRef?: RefObject<ITabContainerRef | null>,
  shouldResync = false,
) {
  const internalTabsRef = useRef<ITabContainerRef | null>(null);
  const resolvedTabsRef = tabsRef ?? internalTabsRef;
  const [activeTabName, setActiveTabName] = useState(targetTabName);

  useEffect(() => {
    const currentTabName = resolvedTabsRef.current?.getFocusedTab();
    if (!currentTabName) {
      setActiveTabName(targetTabName);
      return;
    }
    if (currentTabName !== targetTabName) {
      resolvedTabsRef.current?.jumpToTab(targetTabName);
      if (!shouldResync) {
        setActiveTabName(targetTabName);
      }
      return;
    }
    setActiveTabName(targetTabName);
  }, [resolvedTabsRef, shouldResync, targetTabName]);

  useEffect(() => {
    if (!shouldResync) {
      return;
    }

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let retryCount = 0;

    const runResync = () => {
      if (cancelled) {
        return;
      }

      const currentTabsRef = resolvedTabsRef.current;
      if (!currentTabsRef) {
        return;
      }

      const currentTabName = currentTabsRef.getFocusedTab();

      if (currentTabName === targetTabName) {
        currentTabsRef.syncCurrentPage();
        setActiveTabName(targetTabName);
        return;
      }

      currentTabsRef.jumpToTab(targetTabName);

      retryCount += 1;
      if (retryCount > 6) {
        const finalTabName = currentTabsRef.getFocusedTab();
        setActiveTabName(finalTabName || targetTabName);
        return;
      }

      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(runResync);
      }, 32);
    };

    rafId = requestAnimationFrame(runResync);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [resolvedTabsRef, shouldResync, targetTabName]);

  return {
    activeTabName,
    setActiveTabName,
    tabsRef: resolvedTabsRef,
  };
}
