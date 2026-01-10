import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

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

/**
 * Check if a line has changed (price or label)
 */
function hasLineChanged(prev: ITVLine, current: ITVLine): boolean {
  if (prev.price !== current.price) return true;
  if (prev.qty !== current.qty) return true;
  if (prev.label?.left !== current.label?.left) return true;
  if (prev.label?.right !== current.label?.right) return true;
  return false;
}

/**
 * Check if a line change is PNL-only (only left label changed for position lines)
 * PNL changes are frequent and should be throttled
 */
function isPnlOnlyChange(prev: ITVLine, current: ITVLine): boolean {
  // Only position lines have PNL in left label
  if (current.kind !== 'position') return false;

  // Check if only the left label (PNL) changed
  const priceChanged = prev.price !== current.price;
  const qtyChanged = prev.qty !== current.qty;
  const rightLabelChanged = prev.label?.right !== current.label?.right;
  const leftLabelChanged = prev.label?.left !== current.label?.left;

  // PNL-only if left label changed but nothing else
  return leftLabelChanged && !priceChanged && !qtyChanged && !rightLabelChanged;
}

/**
 * Check if a patch contains only PNL updates (no structural changes)
 */
function isPnlOnlyPatch(
  patch: ITVLinesPatchPayload,
  prevLines: Map<string, ITVLine>,
): boolean {
  // Structural changes require immediate update
  if (patch.add.length > 0 || patch.remove.length > 0) return false;

  // Check if all updates are PNL-only
  for (const line of patch.update) {
    const prevLine = prevLines.get(line.id);
    if (!prevLine || !isPnlOnlyChange(prevLine, line)) {
      return false;
    }
  }

  return patch.update.length > 0;
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
  const [{ activePositions }] = usePerpsActivePositionAtom();
  const [{ openOrdersByCoin }] = usePerpsActiveOpenOrdersAtom();

  // Store previous lines for diff calculation
  const prevLinesRef = useRef<Map<string, ITVLine>>(new Map());
  const prevSymbolRef = useRef<string>(symbol);

  // PNL throttle refs
  const pnlThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingPnlPatchRef = useRef<ITVLinesPatchPayload | null>(null);
  const lastPnlUpdateTimeRef = useRef<number>(0);

  // Get orders for current symbol
  const currentOrders = useMemo(
    () => openOrdersByCoin[symbol] || [],
    [openOrdersByCoin, symbol],
  );

  // Build current lines
  const currentLines = useMemo(() => {
    if (!userAddress) {
      return [];
    }
    return buildAllLinesForSymbol(
      activePositions,
      currentOrders,
      symbol,
      szDecimals,
    );
  }, [activePositions, currentOrders, symbol, szDecimals, userAddress]);

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
        // Structural changes: send immediately
        // Clear any pending PNL update
        if (pnlThrottleTimerRef.current) {
          clearTimeout(pnlThrottleTimerRef.current);
          pnlThrottleTimerRef.current = null;
        }
        pendingPnlPatchRef.current = null;
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
    [doSendPatch],
  );

  // Cleanup throttle timer on unmount
  useEffect(
    () => () => {
      if (pnlThrottleTimerRef.current) {
        clearTimeout(pnlThrottleTimerRef.current);
        pnlThrottleTimerRef.current = null;
      }
    },
    [],
  );

  // Handle symbol change
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      // Symbol changed, clear old lines and sync new ones
      // Also clear any pending PNL updates
      if (pnlThrottleTimerRef.current) {
        clearTimeout(pnlThrottleTimerRef.current);
        pnlThrottleTimerRef.current = null;
      }
      pendingPnlPatchRef.current = null;

      if (isReady) {
        sendLinesClear();
        // Small delay to ensure clear is processed before sync
        setTimeout(() => {
          sendLinesSync();
        }, 50);
      }
      prevSymbolRef.current = symbol;
    }
  }, [symbol, isReady, sendLinesClear, sendLinesSync]);

  // Handle user logout
  useEffect(() => {
    if (!userAddress && isReady) {
      sendLinesClear();
    }
  }, [userAddress, isReady, sendLinesClear]);

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
