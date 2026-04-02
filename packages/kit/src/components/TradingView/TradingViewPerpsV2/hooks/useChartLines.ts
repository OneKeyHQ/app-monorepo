import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { MESSAGE_TYPES } from '../constants/messageTypes';
import { buildAllLinesForSymbol } from '../utils/lineBuilder';

import type { IWebViewRef } from '../../../WebView/types';
import type { ITVLine, ITVLinesPatchPayload } from '../types';

// Revision counter for message ordering
let revisionCounter = 0;

function getNextRevision(): number {
  revisionCounter += 1;
  return revisionCounter;
}

// Throttle interval for PNL-only updates (ms)
const PNL_THROTTLE_INTERVAL = 250;

interface IUseChartLinesParams {
  symbol: string;
  szDecimals: number;
  userAddress: string | undefined | null;
  webRef: React.RefObject<IWebViewRef | null>;
  isReady: boolean; // Whether iframe is ready to receive messages
}

interface IUseChartLinesReturn {
  sendLinesSync: () => void;
  sendLinesClear: () => void;
}

function normalizeAddress(address: string | undefined | null): string | null {
  return address?.toLowerCase() || null;
}

function hasLineChanged(prev: ITVLine, current: ITVLine): boolean {
  return (
    prev.price !== current.price ||
    prev.qty !== current.qty ||
    prev.pnlPositive !== current.pnlPositive ||
    prev.label?.left !== current.label?.left ||
    prev.label?.right !== current.label?.right
  );
}

/**
 * Check if a line change is PNL-only (only left label or pnlPositive changed for position lines).
 * PNL changes are frequent and should be throttled.
 */
function isPnlOnlyChange(prev: ITVLine, current: ITVLine): boolean {
  if (current.kind !== 'position') return false;

  const pnlFieldsChanged =
    prev.label?.left !== current.label?.left ||
    prev.pnlPositive !== current.pnlPositive;

  const nonPnlFieldsUnchanged =
    prev.price === current.price &&
    prev.qty === current.qty &&
    prev.label?.right === current.label?.right;

  return pnlFieldsChanged && nonPnlFieldsUnchanged;
}

function isPnlOnlyPatch(
  patch: ITVLinesPatchPayload,
  prevLines: Map<string, ITVLine>,
): boolean {
  if (patch.add.length > 0 || patch.remove.length > 0) return false;
  if (patch.update.length === 0) return false;

  return patch.update.every((line) => {
    const prevLine = prevLines.get(line.id);
    return prevLine && isPnlOnlyChange(prevLine, line);
  });
}

/**
 * Compute diff between previous and current lines
 */
function computeLinesDiff(
  prevLines: Map<string, ITVLine>,
  currentLines: ITVLine[],
): ITVLinesPatchPayload {
  const currentMap = new Map(currentLines.map((line) => [line.id, line]));

  const add: ITVLine[] = [];
  const update: ITVLine[] = [];
  const remove: string[] = [];

  // Find added and updated lines
  for (const line of currentLines) {
    const prevLine = prevLines.get(line.id);
    if (!prevLine) {
      add.push(line);
    } else if (hasLineChanged(prevLine, line)) {
      update.push(line);
    }
  }

  // Find removed lines
  for (const id of prevLines.keys()) {
    if (!currentMap.has(id)) {
      remove.push(id);
    }
  }

  return {
    symbol: currentLines[0]?.symbol || '',
    revision: getNextRevision(),
    add,
    update,
    remove,
  };
}

export function useChartLines({
  symbol,
  szDecimals,
  userAddress,
  webRef,
  isReady,
}: IUseChartLinesParams): IUseChartLinesReturn {
  const [{ activePositions, accountAddress: positionsAccountAddress }] =
    usePerpsActivePositionAtom();
  const [{ openOrdersByCoin, accountAddress: ordersAccountAddress }] =
    usePerpsActiveOpenOrdersAtom();
  const [{ showChartLines }] = usePerpsCustomSettingsAtom();
  const normalizedUserAddress = useMemo(
    () => normalizeAddress(userAddress),
    [userAddress],
  );

  // Store previous lines for diff calculation
  const prevLinesRef = useRef<Map<string, ITVLine>>(new Map());
  const prevSymbolRef = useRef<string>(symbol);
  const prevIsReadyRef = useRef<boolean>(isReady);
  const prevUserAddressRef = useRef<string | undefined | null>(userAddress);

  // PNL throttle refs
  const pnlThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingPnlPatchRef = useRef<ITVLinesPatchPayload | null>(null);
  const lastPnlUpdateTimeRef = useRef<number>(0);

  // Timeout refs for cleanup
  const symbolChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reloadSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Helper to clear pending PNL updates
  const clearPendingPnlUpdates = useCallback(() => {
    if (pnlThrottleTimerRef.current) {
      clearTimeout(pnlThrottleTimerRef.current);
      pnlThrottleTimerRef.current = null;
    }
    pendingPnlPatchRef.current = null;
  }, []);

  const currentPositions = useMemo(() => {
    if (
      !normalizedUserAddress ||
      normalizeAddress(positionsAccountAddress) !== normalizedUserAddress
    ) {
      return [];
    }

    return activePositions;
  }, [activePositions, normalizedUserAddress, positionsAccountAddress]);

  // Get orders for current symbol
  const currentOrders = useMemo(() => {
    if (
      !normalizedUserAddress ||
      normalizeAddress(ordersAccountAddress) !== normalizedUserAddress
    ) {
      return [];
    }

    return openOrdersByCoin[symbol] || [];
  }, [normalizedUserAddress, openOrdersByCoin, ordersAccountAddress, symbol]);

  // Build current lines (returns empty if showChartLines is disabled)
  const currentLines = useMemo(() => {
    if (!normalizedUserAddress || showChartLines === false) {
      return [];
    }
    return buildAllLinesForSymbol(
      currentPositions,
      currentOrders,
      symbol,
      szDecimals,
    );
  }, [
    currentPositions,
    currentOrders,
    normalizedUserAddress,
    symbol,
    szDecimals,
    showChartLines,
  ]);

  // Send full sync
  const sendLinesSync = useCallback(() => {
    if (!webRef.current || !isReady) {
      return;
    }

    webRef.current.sendMessageViaInjectedScript({
      type: MESSAGE_TYPES.PERPS_TV_LINES_SYNC,
      payload: {
        symbol,
        revision: getNextRevision(),
        lines: currentLines,
      },
    });

    // Update prev lines reference
    prevLinesRef.current = new Map(currentLines.map((line) => [line.id, line]));
  }, [webRef, isReady, symbol, currentLines]);

  // Send clear
  const sendLinesClear = useCallback(() => {
    if (!webRef.current) {
      return;
    }

    webRef.current.sendMessageViaInjectedScript({
      type: MESSAGE_TYPES.PERPS_TV_LINES_CLEAR,
      payload: {
        symbol,
      },
    });

    // Clear prev lines reference
    prevLinesRef.current.clear();
  }, [webRef, symbol]);

  // Internal function to actually send patch
  const doSendPatch = useCallback(
    (patch: ITVLinesPatchPayload) => {
      if (!webRef.current || !isReady) {
        return;
      }

      webRef.current.sendMessageViaInjectedScript({
        type: MESSAGE_TYPES.PERPS_TV_LINES_PATCH,
        payload: patch,
      });

      // Update prev lines reference
      const newPrevLines = new Map(prevLinesRef.current);
      for (const line of patch.add) {
        newPrevLines.set(line.id, line);
      }
      for (const line of patch.update) {
        newPrevLines.set(line.id, line);
      }
      for (const id of patch.remove) {
        newPrevLines.delete(id);
      }
      prevLinesRef.current = newPrevLines;
      lastPnlUpdateTimeRef.current = Date.now();
    },
    [webRef, isReady],
  );

  // Send patch with throttling for PNL-only updates
  const sendLinesPatch = useCallback(
    (patch: ITVLinesPatchPayload) => {
      // Skip if no changes
      if (
        patch.add.length === 0 &&
        patch.update.length === 0 &&
        patch.remove.length === 0
      ) {
        return;
      }

      // Check if this is a PNL-only update
      const isPnlOnly = isPnlOnlyPatch(patch, prevLinesRef.current);

      if (!isPnlOnly) {
        clearPendingPnlUpdates();
        doSendPatch(patch);
        return;
      }

      // PNL-only update: apply throttling
      const now = Date.now();
      const timeSinceLastUpdate = now - lastPnlUpdateTimeRef.current;

      if (timeSinceLastUpdate >= PNL_THROTTLE_INTERVAL) {
        // Enough time passed, send immediately
        doSendPatch(patch);
      } else {
        // Store pending update and schedule
        pendingPnlPatchRef.current = patch;

        if (!pnlThrottleTimerRef.current) {
          const remainingTime = PNL_THROTTLE_INTERVAL - timeSinceLastUpdate;
          pnlThrottleTimerRef.current = setTimeout(() => {
            pnlThrottleTimerRef.current = null;
            if (pendingPnlPatchRef.current) {
              doSendPatch(pendingPnlPatchRef.current);
              pendingPnlPatchRef.current = null;
            }
          }, remainingTime);
        }
      }
    },
    [doSendPatch, clearPendingPnlUpdates],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearPendingPnlUpdates();
      if (symbolChangeTimeoutRef.current) {
        clearTimeout(symbolChangeTimeoutRef.current);
      }
      if (reloadSyncTimeoutRef.current) {
        clearTimeout(reloadSyncTimeoutRef.current);
      }
    };
  }, [clearPendingPnlUpdates]);

  // Handle symbol change
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      clearPendingPnlUpdates();
      prevLinesRef.current.clear();

      // Clear previous timeout
      if (symbolChangeTimeoutRef.current) {
        clearTimeout(symbolChangeTimeoutRef.current);
        symbolChangeTimeoutRef.current = null;
      }

      if (isReady) {
        sendLinesClear();
        // Small delay to ensure clear is processed before sync
        symbolChangeTimeoutRef.current = setTimeout(() => {
          symbolChangeTimeoutRef.current = null;
          sendLinesSync();
        }, 50);
      }
      prevSymbolRef.current = symbol;
    }
  }, [symbol, isReady, sendLinesClear, sendLinesSync, clearPendingPnlUpdates]);

  // Handle user address change (logout or account switch)
  useEffect(() => {
    const prevAddress = prevUserAddressRef.current;
    const hasAddressChanged = prevAddress !== userAddress;

    if (hasAddressChanged) {
      // Clear pending updates
      clearPendingPnlUpdates();
      prevLinesRef.current.clear();

      if (isReady) {
        // Clear old lines first
        sendLinesClear();

        // If switching to a new account (not logout), sync new lines after delay
        if (userAddress && currentLines.length > 0) {
          // Use a timeout to ensure clear is processed before sync
          const timeoutId = setTimeout(() => {
            sendLinesSync();
          }, 50);

          prevUserAddressRef.current = userAddress;
          return () => clearTimeout(timeoutId);
        }
      }

      prevUserAddressRef.current = userAddress;
    }
  }, [
    userAddress,
    isReady,
    sendLinesClear,
    sendLinesSync,
    currentLines,
    clearPendingPnlUpdates,
  ]);

  // Handle WebView reload
  useEffect(() => {
    const prevIsReady = prevIsReadyRef.current;
    const isReloading = prevIsReady && !isReady;
    const isReloaded = !prevIsReady && isReady;

    if (isReloading || isReloaded) {
      clearPendingPnlUpdates();
      prevLinesRef.current.clear();

      // Clear previous reload timeout
      if (reloadSyncTimeoutRef.current) {
        clearTimeout(reloadSyncTimeoutRef.current);
        reloadSyncTimeoutRef.current = null;
      }
    }

    if (isReloaded && userAddress && currentLines.length > 0) {
      reloadSyncTimeoutRef.current = setTimeout(() => {
        reloadSyncTimeoutRef.current = null;
        if (isReady && userAddress && currentLines.length > 0) {
          sendLinesSync();
        }
      }, 100);
    }

    prevIsReadyRef.current = isReady;
  }, [
    isReady,
    userAddress,
    currentLines,
    sendLinesSync,
    clearPendingPnlUpdates,
  ]);

  // Handle lines update (incremental)
  useEffect(() => {
    if (!isReady || !userAddress) {
      return;
    }

    // If no previous lines, do full sync
    if (prevLinesRef.current.size === 0 && currentLines.length > 0) {
      sendLinesSync();
      return;
    }

    // Compute and send diff
    const patch = computeLinesDiff(prevLinesRef.current, currentLines);
    patch.symbol = symbol;
    sendLinesPatch(patch);
  }, [
    currentLines,
    isReady,
    userAddress,
    symbol,
    sendLinesSync,
    sendLinesPatch,
  ]);

  return {
    sendLinesSync,
    sendLinesClear,
  };
}
