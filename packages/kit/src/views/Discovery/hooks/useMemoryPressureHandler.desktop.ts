import { useEffect } from 'react';

import { Toast } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IWebTab } from '../types';
import { webviewRefs } from '../utils/explorerUtils';

import { useActiveTabId, useWebTabs } from './useWebTabs';

/**
 * Desktop-only hook to handle memory pressure events from main process
 * Automatically reloads inactive tabs when memory usage is critical (>2GB)
 */
export function useMemoryPressureHandler() {
  const { tabs } = useWebTabs();
  const { activeTabId: currentTabId } = useActiveTabId();

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
        // Get all inactive tabs (not current tab)
        const inactiveTabs = tabs.filter(
          (tab: IWebTab) => tab.id !== currentTabId,
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
                electronWebview.stop();
              }

              // Clear the webview's cache
              if (electronWebview.getWebContents) {
                const webContents = electronWebview.getWebContents();
                if (webContents && webContents.session) {
                  void webContents.session.clearCache();
                }
              }

              // Reload the webview
              if (typeof electronWebview.reload === 'function') {
                electronWebview.reload();
                reloadedCount++;
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
    if (globalThis.desktopApi) {
      globalThis.desktopApi.on('memory-pressure-warning', handleMemoryWarning);
      globalThis.desktopApi.on(
        'memory-pressure-critical',
        handleMemoryCritical,
      );
    }
    // Note: No cleanup needed as this component persists throughout app lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
