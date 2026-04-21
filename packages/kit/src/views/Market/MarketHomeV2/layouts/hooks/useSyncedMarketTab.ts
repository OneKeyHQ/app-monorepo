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
  const pendingPageSyncRef = useRef(false);
  const wasResyncEnabledRef = useRef(shouldResync);

  useEffect(() => {
    if (shouldResync && !wasResyncEnabledRef.current) {
      pendingPageSyncRef.current = true;
    }
    if (!shouldResync) {
      pendingPageSyncRef.current = false;
    }
  }, [shouldResync, targetTabName]);

  useEffect(() => {
    const currentTabsRef = resolvedTabsRef.current;
    const currentTabName = currentTabsRef?.getFocusedTab();
    if (!currentTabName) {
      setActiveTabName(targetTabName);
      return;
    }
    if (currentTabName !== targetTabName) {
      if (shouldResync) {
        pendingPageSyncRef.current = true;
      }
      currentTabsRef?.jumpToTab(targetTabName);
      if (!shouldResync) {
        setActiveTabName(targetTabName);
      }
      return;
    }
    setActiveTabName(targetTabName);
  }, [resolvedTabsRef, shouldResync, targetTabName]);

  useEffect(() => {
    if (!shouldResync || !pendingPageSyncRef.current) {
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
        pendingPageSyncRef.current = false;
        setActiveTabName(targetTabName);
        return;
      }

      pendingPageSyncRef.current = true;
      currentTabsRef.jumpToTab(targetTabName);

      retryCount += 1;
      if (retryCount > 6) {
        const finalTabName = currentTabsRef.getFocusedTab();
        pendingPageSyncRef.current = false;
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

  useEffect(() => {
    wasResyncEnabledRef.current = shouldResync;
  }, [shouldResync]);

  return {
    activeTabName,
    setActiveTabName,
    tabsRef: resolvedTabsRef,
  };
}
