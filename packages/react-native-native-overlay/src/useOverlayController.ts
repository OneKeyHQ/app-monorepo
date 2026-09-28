import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { OVERLAY_MOTION_PRESETS } from './animation/platformMotionPresets';
import { resolveOverlayAnimation } from './animation/resolveAnimation';
import { useOverlayPageScope } from './OverlayPageScope';
import { overlayStore } from './OverlayStore';

import type { IResolvedOverlayAnimation } from './animation/resolveAnimation';
import type {
  IOverlayRequestDismissReason,
  IOverlayViewProps,
} from './OverlayViewTypes';
import type { IOverlayEntry } from './types';

export interface IOverlayController {
  entry: IOverlayEntry | undefined;
  /** Render the content (entry is active or closing). */
  mounted: boolean;
  /**
   * Ask the host to show the content. Page entries stay presented while
   * suspended; the page host hides them instead (the owner may be frozen).
   */
  presented: boolean;
  scope: 'global' | 'page';
  hostKey: string | undefined;
  ownerKey: string | undefined;
  animation: IResolvedOverlayAnimation;
  onHostPresented: () => void;
  onHostDismissed: () => void;
  onHostRequestDismiss: (reason: IOverlayRequestDismissReason) => void;
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Bridges a declarative overlay to the shared `overlayStore`: requests an
 * entry while `visible`, follows the store's phase, and finalizes the entry
 * once the host reports the end of the exit animation.
 */
export function useOverlayController(
  props: IOverlayViewProps,
): IOverlayController {
  const {
    visible,
    level,
    strategy,
    priority,
    replaceKey,
    blocking,
    dismissOnBackPress,
    presentation = 'center',
    animation,
  } = props;
  const pageScope = useOverlayPageScope();
  const hostKey = props.hostKey ?? pageScope.hostKey;
  const ownerKey = props.ownerKey ?? pageScope.ownerKey;
  // Without a host or owner there is nowhere to anchor a page overlay.
  const scope =
    props.scope === 'page' && hostKey && ownerKey ? 'page' : 'global';
  const baseId = useId();
  const cycleRef = useRef(0);
  const [entryId, setEntryId] = useState<string | undefined>();
  // Set when the store closed the entry (replace, back) while `visible` is
  // still true, so the effect below does not immediately reopen it.
  const closedByStoreRef = useRef(false);
  const propsRef = useLatest(props);

  const snapshot = useSyncExternalStore(
    overlayStore.subscribe,
    overlayStore.getSnapshot,
    overlayStore.getSnapshot,
  );
  const entry = useMemo(
    () =>
      entryId
        ? (snapshot.entries.find((e) => e.id === entryId) ??
          snapshot.queued.find((e) => e.id === entryId))
        : undefined,
    [entryId, snapshot],
  );

  useEffect(() => {
    if (!visible) {
      closedByStoreRef.current = false;
      if (entryId) {
        overlayStore.dismiss(entryId, 'programmatic');
      }
      return;
    }
    if (entryId || closedByStoreRef.current) {
      return;
    }
    cycleRef.current += 1;
    const id = `overlay-view${baseId}${cycleRef.current}`;
    overlayStore.request(
      {
        id,
        scope,
        hostKey,
        ownerKey,
        level,
        strategy,
        priority,
        replaceKey,
        blocking,
        dismissible: dismissOnBackPress,
      },
      {
        onRemoved: (reason) => {
          setEntryId((current) => (current === id ? undefined : current));
          if (reason !== 'programmatic') {
            closedByStoreRef.current = true;
          }
          propsRef.current.onClose?.(reason);
        },
      },
    );
    setEntryId(id);
    // Level / strategy changes apply to the next open cycle only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entryId]);

  useEffect(
    () => () => {
      if (entryId) {
        overlayStore.dismiss(entryId, 'system');
        overlayStore.finalize(entryId);
      }
    },
    [entryId],
  );

  const resolvedAnimation = useMemo(
    () =>
      resolveOverlayAnimation(presentation, animation, OVERLAY_MOTION_PRESETS),
    [presentation, animation],
  );

  const onHostPresented = useCallback(() => {
    propsRef.current.onPresented?.();
  }, [propsRef]);

  const onHostDismissed = useCallback(() => {
    if (!entryId) {
      return;
    }
    const phase = overlayStore.getEntry(entryId)?.phase;
    if (phase === 'active') {
      // Native closed it on its own, e.g. a lower sheet in the same level
      // window was dismissed and UIKit took the ones above with it.
      overlayStore.dismiss(entryId, 'system');
    }
    overlayStore.finalize(entryId);
  }, [entryId]);

  const onHostRequestDismiss = useCallback(
    (reason: IOverlayRequestDismissReason) => {
      const handler = propsRef.current.onRequestDismiss;
      handler?.(reason);
      if (entryId && (!handler || reason === 'pan')) {
        overlayStore.dismiss(entryId, reason);
      }
    },
    [entryId, propsRef],
  );

  return {
    entry,
    mounted: !!entry && entry.phase !== 'queued',
    presented:
      !!entry &&
      entry.phase === 'active' &&
      (scope === 'page' || !entry.suspended),
    scope,
    hostKey: scope === 'page' ? hostKey : undefined,
    ownerKey: scope === 'page' ? ownerKey : undefined,
    animation: resolvedAnimation,
    onHostPresented,
    onHostDismissed,
    onHostRequestDismiss,
  };
}
