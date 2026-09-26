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
  /** Ask the host to show the content (entry is active and not suspended). */
  presented: boolean;
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
    if (entryId && overlayStore.getEntry(entryId)?.phase === 'closing') {
      overlayStore.finalize(entryId);
    }
  }, [entryId]);

  const onHostRequestDismiss = useCallback(
    (reason: IOverlayRequestDismissReason) => {
      const handler = propsRef.current.onRequestDismiss;
      if (handler) {
        handler(reason);
      } else if (entryId) {
        overlayStore.dismiss(entryId, reason);
      }
    },
    [entryId, propsRef],
  );

  return {
    entry,
    mounted: !!entry && entry.phase !== 'queued',
    presented: !!entry && entry.phase === 'active' && !entry.suspended,
    animation: resolvedAnimation,
    onHostPresented,
    onHostDismissed,
    onHostRequestDismiss,
  };
}
