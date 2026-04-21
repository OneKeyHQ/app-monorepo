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
      console.log('[MarketTab][useSyncedMarketTab] focus resync armed', {
        targetTabName,
      });
    }
    if (!shouldResync) {
      pendingPageSyncRef.current = false;
    }
  }, [shouldResync, targetTabName]);

  useEffect(() => {
    const currentTabsRef = resolvedTabsRef.current;
    const currentTabName = currentTabsRef?.getFocusedTab();
    console.log('[MarketTab][useSyncedMarketTab] target effect', {
      targetTabName,
      currentTabName,
      shouldResync,
      pendingPageSync: pendingPageSyncRef.current,
    });
    if (!currentTabName) {
      console.log('[MarketTab][useSyncedMarketTab] no focused tab', {
        targetTabName,
      });
      setActiveTabName(targetTabName);
      return;
    }
    if (currentTabName !== targetTabName) {
      if (shouldResync) {
        pendingPageSyncRef.current = true;
      }
      console.log('[MarketTab][useSyncedMarketTab] jumpToTab', {
        from: currentTabName,
        to: targetTabName,
        shouldResync,
        pendingPageSync: pendingPageSyncRef.current,
      });
      currentTabsRef?.jumpToTab(targetTabName);
      if (!shouldResync) {
        setActiveTabName(targetTabName);
      }
      return;
    }
    console.log('[MarketTab][useSyncedMarketTab] already aligned', {
      targetTabName,
    });
    setActiveTabName(targetTabName);
  }, [resolvedTabsRef, shouldResync, targetTabName]);

  useEffect(() => {
    if (!shouldResync || !pendingPageSyncRef.current) {
      console.log('[MarketTab][useSyncedMarketTab] resync skipped', {
        targetTabName,
        shouldResync,
        pendingPageSync: pendingPageSyncRef.current,
      });
      return;
    }

    console.log('[MarketTab][useSyncedMarketTab] resync scheduled', {
      targetTabName,
    });

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
      console.log('[MarketTab][useSyncedMarketTab] resync tick', {
        targetTabName,
        currentTabName,
        retryCount,
      });

      if (currentTabName === targetTabName) {
        console.log('[MarketTab][useSyncedMarketTab] syncCurrentPage', {
          targetTabName,
          currentTabName,
          retryCount,
        });
        currentTabsRef.syncCurrentPage();
        pendingPageSyncRef.current = false;
        setActiveTabName(targetTabName);
        return;
      }

      pendingPageSyncRef.current = true;
      console.log('[MarketTab][useSyncedMarketTab] resync jumpToTab', {
        from: currentTabName,
        to: targetTabName,
        retryCount,
      });
      currentTabsRef.jumpToTab(targetTabName);

      retryCount += 1;
      if (retryCount > 6) {
        const finalTabName = currentTabsRef.getFocusedTab();
        pendingPageSyncRef.current = false;
        console.log('[MarketTab][useSyncedMarketTab] resync stopped', {
          targetTabName,
          finalTabName,
          retryCount,
        });
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
      console.log('[MarketTab][useSyncedMarketTab] resync cleanup', {
        targetTabName,
      });
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
