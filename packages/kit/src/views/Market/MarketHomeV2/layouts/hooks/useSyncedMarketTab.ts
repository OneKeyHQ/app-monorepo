import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';

import { debugMarketTabsLog } from '../../debugMarketTabsLog';

interface IUseSyncedMarketTabOptions {
  onBeforeJumpToTab?: (targetTabName: string) => void;
  shouldDeferJumpToTab?: (params: {
    targetTabName: string;
    currentTabName: string;
  }) => boolean;
}

export function useSyncedMarketTab(
  targetTabName: string,
  tabsRef?: RefObject<ITabContainerRef | null>,
  shouldResync = false,
  options?: IUseSyncedMarketTabOptions,
) {
  const { onBeforeJumpToTab, shouldDeferJumpToTab } = options ?? {};
  const internalTabsRef = useRef<ITabContainerRef | null>(null);
  const resolvedTabsRef = tabsRef ?? internalTabsRef;
  const [activeTabName, setActiveTabName] = useState(targetTabName);
  const pendingPageSyncRef = useRef(false);
  const wasResyncEnabledRef = useRef(shouldResync);

  useEffect(() => {
    if (shouldResync && !wasResyncEnabledRef.current) {
      debugMarketTabsLog('sync.enable-resync', {
        targetTabName,
      });
      pendingPageSyncRef.current = true;
    }
    if (!shouldResync) {
      debugMarketTabsLog('sync.disable-resync', {
        targetTabName,
      });
      pendingPageSyncRef.current = false;
    }
  }, [shouldResync, targetTabName]);

  useEffect(() => {
    const currentTabsRef = resolvedTabsRef.current;
    const currentTabName = currentTabsRef?.getFocusedTab();
    debugMarketTabsLog('sync.target-effect', {
      targetTabName,
      currentTabName,
      shouldResync,
      hasTabsRef: !!currentTabsRef,
    });
    if (!currentTabName) {
      setActiveTabName(targetTabName);
      return;
    }
    if (currentTabName !== targetTabName) {
      if (shouldResync) {
        pendingPageSyncRef.current = true;
      }
      if (
        shouldResync &&
        shouldDeferJumpToTab?.({
          targetTabName,
          currentTabName,
        })
      ) {
        debugMarketTabsLog('sync.defer-jump-target', {
          from: currentTabName,
          to: targetTabName,
          shouldResync,
        });
        setActiveTabName(targetTabName);
        return;
      }
      debugMarketTabsLog('sync.jump-target', {
        from: currentTabName,
        to: targetTabName,
        shouldResync,
      });
      onBeforeJumpToTab?.(targetTabName);
      currentTabsRef?.jumpToTab(targetTabName);
      if (!shouldResync) {
        setActiveTabName(targetTabName);
      }
      return;
    }
    setActiveTabName(targetTabName);
  }, [
    onBeforeJumpToTab,
    resolvedTabsRef,
    shouldDeferJumpToTab,
    shouldResync,
    targetTabName,
  ]);

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
        debugMarketTabsLog('sync.retry.no-ref', {
          targetTabName,
          retryCount,
        });
        return;
      }

      const currentTabName = currentTabsRef.getFocusedTab();

      if (currentTabName === targetTabName) {
        debugMarketTabsLog('sync.current-page', {
          targetTabName,
          retryCount,
        });
        currentTabsRef.syncCurrentPage();
        pendingPageSyncRef.current = false;
        setActiveTabName(targetTabName);
        return;
      }

      pendingPageSyncRef.current = true;
      if (
        shouldDeferJumpToTab?.({
          targetTabName,
          currentTabName,
        })
      ) {
        debugMarketTabsLog('sync.retry-defer-jump', {
          from: currentTabName,
          to: targetTabName,
          retryCount,
        });
        timeoutId = setTimeout(() => {
          rafId = requestAnimationFrame(runResync);
        }, 32);
        return;
      }

      debugMarketTabsLog('sync.retry-jump', {
        from: currentTabName,
        to: targetTabName,
        retryCount,
      });
      onBeforeJumpToTab?.(targetTabName);
      currentTabsRef.jumpToTab(targetTabName);

      retryCount += 1;
      if (retryCount > 6) {
        const finalTabName = currentTabsRef.getFocusedTab();
        debugMarketTabsLog('sync.retry-stop', {
          targetTabName,
          finalTabName,
          retryCount,
        });
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
  }, [
    onBeforeJumpToTab,
    resolvedTabsRef,
    shouldDeferJumpToTab,
    shouldResync,
    targetTabName,
  ]);

  useEffect(() => {
    wasResyncEnabledRef.current = shouldResync;
  }, [shouldResync]);

  return {
    activeTabName,
    setActiveTabName,
    tabsRef: resolvedTabsRef,
  };
}
