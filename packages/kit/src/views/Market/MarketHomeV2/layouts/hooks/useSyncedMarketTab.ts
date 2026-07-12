import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { ITabContainerRef } from '@onekeyhq/components';

interface IUseSyncedMarketTabOptions {
  onBeforeJumpToTab?: (targetTabName: string) => void;
  shouldDeferPageSync?: (params: {
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
  const { onBeforeJumpToTab, shouldDeferPageSync } = options ?? {};
  const internalTabsRef = useRef<ITabContainerRef | null>(null);
  const resolvedTabsRef = tabsRef ?? internalTabsRef;
  const [activeTabName, setActiveTabName] = useState(targetTabName);
  const pendingPageSyncRef = useRef(false);
  const wasResyncEnabledRef = useRef(shouldResync);
  const targetTabNameRef = useRef(targetTabName);
  targetTabNameRef.current = targetTabName;
  const cancelledTargetTabNameRef = useRef<string | undefined>(undefined);
  const [syncRequestVersion, setSyncRequestVersion] = useState(0);

  const requestPageSync = useCallback(() => {
    const wasPending = pendingPageSyncRef.current;
    cancelledTargetTabNameRef.current = undefined;
    pendingPageSyncRef.current = true;
    if (!wasPending) {
      setSyncRequestVersion((version) => version + 1);
    }
  }, []);

  const cancelPageSync = useCallback(() => {
    cancelledTargetTabNameRef.current = targetTabNameRef.current;
    pendingPageSyncRef.current = false;
    setSyncRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (shouldResync && !wasResyncEnabledRef.current) {
      cancelledTargetTabNameRef.current = undefined;
      pendingPageSyncRef.current = true;
    }
    if (!shouldResync) {
      cancelledTargetTabNameRef.current = undefined;
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
        if (cancelledTargetTabNameRef.current === targetTabName) {
          return;
        }
        pendingPageSyncRef.current = true;
        return;
      }
      onBeforeJumpToTab?.(targetTabName);
      currentTabsRef?.jumpToTab(targetTabName);
      setActiveTabName(targetTabName);
      return;
    }
    cancelledTargetTabNameRef.current = undefined;
    setActiveTabName(targetTabName);
  }, [
    onBeforeJumpToTab,
    resolvedTabsRef,
    shouldResync,
    syncRequestVersion,
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

    const scheduleNextSync = (runPageSync: () => void) => {
      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(runPageSync);
      }, 32);
    };

    const runPageSync = () => {
      if (cancelled) {
        return;
      }

      const currentTabsRef = resolvedTabsRef.current;
      if (!currentTabsRef) {
        return;
      }

      const currentTabName = currentTabsRef.getFocusedTab();
      pendingPageSyncRef.current = true;

      if (
        shouldDeferPageSync?.({
          targetTabName,
          currentTabName,
        })
      ) {
        scheduleNextSync(runPageSync);
        return;
      }

      if (currentTabName === targetTabName) {
        currentTabsRef.syncCurrentPage();
        pendingPageSyncRef.current = false;
        setActiveTabName(targetTabName);
        return;
      }

      onBeforeJumpToTab?.(targetTabName);
      currentTabsRef.jumpToTab(targetTabName);

      retryCount += 1;
      if (retryCount > 6) {
        const finalTabName = currentTabsRef.getFocusedTab();
        pendingPageSyncRef.current = false;
        setActiveTabName(finalTabName || targetTabName);
        return;
      }

      scheduleNextSync(runPageSync);
    };

    rafId = requestAnimationFrame(runPageSync);

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
    shouldDeferPageSync,
    shouldResync,
    syncRequestVersion,
    targetTabName,
  ]);

  useEffect(() => {
    wasResyncEnabledRef.current = shouldResync;
  }, [shouldResync]);

  return {
    activeTabName,
    cancelPageSync,
    requestPageSync,
    setActiveTabName,
    tabsRef: resolvedTabsRef,
  };
}
