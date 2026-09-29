/* cspell:ignore hoverable Hoverable */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

import {
  autoUpdate,
  computePosition,
  flip,
  offset as offsetMiddleware,
  shift,
  size,
} from '@floating-ui/dom';
import { OVERLAY_LEVEL_ORDER } from '@onekeyfe/react-native-native-overlay';

import type { Placement } from '@floating-ui/dom';
import type { IOverlayLevel } from '@onekeyfe/react-native-native-overlay';

// Keep the panel this far from the viewport edges.
const VIEWPORT_PADDING = 8;
// Lets the pointer cross the gap between trigger and panel.
const DEFAULT_HOVER_CLOSE_DELAY_MS = 100;

export type IPopoverHoverable =
  | boolean
  | { delay?: number | { open?: number; close?: number } };

export function getHoverDelays(hoverable: IPopoverHoverable | undefined) {
  if (!hoverable || hoverable === true) {
    return { open: 0, close: DEFAULT_HOVER_CLOSE_DELAY_MS };
  }
  const { delay } = hoverable;
  if (typeof delay === 'number') {
    return { open: delay, close: delay };
  }
  return {
    open: delay?.open ?? 0,
    close: delay?.close ?? DEFAULT_HOVER_CLOSE_DELAY_MS,
  };
}

/**
 * Anchors the panel to the trigger while open (Floating UI: offset, flip,
 * shift, and a max height from the available space) and follows scroll /
 * resize / layout changes of either.
 *
 * The enter animation scales the panel's ancestor, which Floating UI reads
 * as a smaller panel; call the returned `reposition` once it has settled.
 */
export function useAnchoredPosition({
  open,
  triggerRef,
  panel,
  placement,
  offset,
  allowFlip,
}: {
  open: boolean;
  triggerRef: RefObject<unknown>;
  /** The panel element: it mounts a render after `open` flips. */
  panel: HTMLDivElement | null;
  placement: Placement;
  offset: number;
  allowFlip: boolean;
}) {
  const updateRef = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    const reference = triggerRef.current as HTMLElement | null;
    const floating = panel;
    if (!open || !reference || !floating) {
      return;
    }
    const update = () => {
      void computePosition(reference, floating, {
        strategy: 'absolute',
        placement,
        middleware: [
          offsetMiddleware(offset),
          allowFlip ? flip({ padding: VIEWPORT_PADDING }) : undefined,
          shift({ padding: VIEWPORT_PADDING }),
          size({
            padding: VIEWPORT_PADDING,
            apply({ availableHeight }) {
              floating.style.maxHeight = `${Math.max(
                0,
                Math.floor(availableHeight),
              )}px`;
            },
          }),
        ],
      }).then(({ x, y }) => {
        floating.style.left = `${x}px`;
        floating.style.top = `${y}px`;
      });
    };
    updateRef.current = update;
    const cleanup = autoUpdate(reference, floating, update);
    return () => {
      updateRef.current = undefined;
      cleanup();
    };
  }, [allowFlip, offset, open, panel, placement, triggerRef]);
  return useCallback(() => updateRef.current?.(), []);
}

function overlayRank(element: Element | null): [number, number] | undefined {
  const entry = element?.closest<HTMLElement>('[data-onekey-overlay-entry]');
  const layer = entry?.closest('[data-onekey-overlay-layer]');
  if (!entry || !layer) {
    return undefined;
  }
  const level = layer.getAttribute(
    'data-onekey-overlay-layer',
  ) as IOverlayLevel;
  return [OVERLAY_LEVEL_ORDER[level] ?? 0, Number(entry.dataset.stackOrder)];
}

function isRankedAbove(target: Element, own: Element) {
  const targetRank = overlayRank(target);
  const ownRank = overlayRank(own);
  if (!targetRank || !ownRank) {
    return false;
  }
  return (
    targetRank[0] > ownRank[0] ||
    (targetRank[0] === ownRank[0] && targetRank[1] > ownRank[1])
  );
}

/**
 * Closes the popover on a press outside the panel and the trigger. Presses
 * inside an overlay stacked above it (a nested select, a dialog opened from
 * the panel) keep it open.
 */
export function useOutsidePress({
  enabled,
  panelRef,
  triggerRef,
  onOutsidePress,
}: {
  enabled: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<unknown>;
  onOutsidePress: () => void;
}) {
  const onOutsidePressRef = useRef(onOutsidePress);
  onOutsidePressRef.current = onOutsidePress;
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const panel = panelRef.current;
      const trigger = triggerRef.current as HTMLElement | null;
      if (
        !target ||
        !panel ||
        panel.contains(target) ||
        trigger?.contains(target) ||
        isRankedAbove(target, panel)
      ) {
        return;
      }
      onOutsidePressRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [enabled, panelRef, triggerRef]);
}

/**
 * Hover-driven open state: entering the trigger opens after the open delay,
 * leaving the trigger or the panel closes after the close delay unless the
 * pointer enters the other one first.
 */
export function useHoverOpen({
  hoverable,
  triggerRef,
  panel,
  open,
  onOpen,
  onClose,
}: {
  hoverable: IPopoverHoverable | undefined;
  triggerRef: RefObject<unknown>;
  panel: HTMLDivElement | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacksRef = useRef({ onOpen, onClose, open });
  callbacksRef.current = { onOpen, onClose, open };
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);
  const delays = getHoverDelays(hoverable);
  const openDelay = delays.open;
  const closeDelay = delays.close;

  useEffect(() => {
    const trigger = triggerRef.current as HTMLElement | null;
    if (!hoverable || !trigger) {
      return;
    }
    const scheduleOpen = () => {
      clear();
      timerRef.current = setTimeout(() => {
        if (!callbacksRef.current.open) {
          callbacksRef.current.onOpen();
        }
      }, openDelay);
    };
    const scheduleClose = () => {
      clear();
      timerRef.current = setTimeout(() => {
        if (callbacksRef.current.open) {
          callbacksRef.current.onClose();
        }
      }, closeDelay);
    };
    trigger.addEventListener('mouseenter', scheduleOpen);
    trigger.addEventListener('mouseleave', scheduleClose);
    panel?.addEventListener('mouseenter', clear);
    panel?.addEventListener('mouseleave', scheduleClose);
    return () => {
      clear();
      trigger.removeEventListener('mouseenter', scheduleOpen);
      trigger.removeEventListener('mouseleave', scheduleClose);
      panel?.removeEventListener('mouseenter', clear);
      panel?.removeEventListener('mouseleave', scheduleClose);
    };
  }, [clear, closeDelay, hoverable, openDelay, panel, triggerRef]);
}
