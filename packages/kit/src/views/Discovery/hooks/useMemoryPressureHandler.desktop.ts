import { useEffect, useRef } from 'react';

import { Toast } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId, useWebTabs } from './useWebTabs';

import type { IWebTab } from '../types';

/**
 * Desktop-only hook to handle memory pressure events from main process
 * Automatically reloads inactive tabs when memory usage is critical (>2GB)
 */
export function useMemoryPressureHandler() {
  const { tabs } = useWebTabs();
  const { activeTabId: currentTabId } = useActiveTabId();

  // Use refs to avoid stale closures in IPC handlers
  const tabsRef = useRef(tabs);
  const currentTabIdRef = useRef(currentTabId);
  tabsRef.current = tabs;
  currentTabIdRef.current = currentTabId;

  useEffect(() => {
    if (!platformEnv.isDesktop) {
      return;
    }

    // Handler for warning level (1GB+)
    const handleMemoryWarning = (event: any) => {
      const { currentMemoryMB } = event as {
        currentMemoryMB: number;
        thresholdMB: number;
        level: 'warning';
      };

      console.warn(
        `[Memory Pressure] Warning: ${currentMemoryMB}MB memory usage detected`,
      );

      // Show toast notification to user
      Toast.warning({
        title: 'High Memory Usage',
        message: `Memory usage is ${currentMemoryMB}MB. Consider closing some browser tabs.`,
      });
    };

    // Handler for critical level (2GB+)
    const handleMemoryCritical = (event: any) => {
      const { currentMemoryMB, action } = event as {
        currentMemoryMB: number;
        thresholdMB: number;
        level: 'critical';
        action: 'reload-inactive-tabs';
      };

      console.error(
        `[Memory Pressure] CRITICAL: ${currentMemoryMB}MB memory usage - triggering cleanup`,
      );

      if (action === 'reload-inactive-tabs') {
        // Read latest values from refs to avoid stale closure
        const currentTabs = tabsRef.current;
        const activeTabId = currentTabIdRef.current;

        // Get all inactive tabs (not current tab)
        const inactiveTabs = currentTabs.filter(
          (tab: IWebTab) => tab.id !== activeTabId,
        );

        console.log(
          `[Memory Pressure] Reloading ${inactiveTabs.length} inactive tabs`,
        );

        // Reload each inactive tab to release memory
        let reloadedCount = 0;
        inactiveTabs.forEach((tab: IWebTab) => {
          const webviewRef = webviewRefs[tab.id];
          if (webviewRef && webviewRef.innerRef) {
            try {
              // Type assertion for Electron webview
              const electronWebview = webviewRef.innerRef as any;

              // First, stop all running processes in the webview
              if (typeof electronWebview.stop === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                electronWebview.stop();
              }

              // Note: Do NOT call session.clearCache() here — all webviews
              // share the same session, so clearing cache would affect all
              // tabs and cause reloaded tabs to re-fetch everything.

              // Reload the webview
              if (typeof electronWebview.reload === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                electronWebview.reload();
                reloadedCount += 1;
              }

              console.log(`[Memory Pressure] Reloaded tab: ${tab.id}`);
            } catch (error) {
              console.error(
                `[Memory Pressure] Failed to reload tab ${tab.id}:`,
                error,
              );
            }
          }
        });

        // Show toast notification
        Toast.success({
          title: 'Memory Cleanup Complete',
          message: `Reloaded ${reloadedCount} inactive ${reloadedCount === 1 ? 'tab' : 'tabs'} to free up memory.`,
        });
      }
    };

    // Listen to IPC events from main process
    // desktopApi.on() returns a cleanup function (or undefined if channel not in validChannels)
    let removeWarningListener: (() => void) | undefined;
    let removeCriticalListener: (() => void) | undefined;

    if (globalThis.desktopApi) {
      removeWarningListener = globalThis.desktopApi.on(
        'memory-pressure-warning',
        handleMemoryWarning,
      );
      removeCriticalListener = globalThis.desktopApi.on(
        'memory-pressure-critical',
        handleMemoryCritical,
      );
    }

    return () => {
      if (removeWarningListener) {
        removeWarningListener();
      }
      if (removeCriticalListener) {
        removeCriticalListener();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
