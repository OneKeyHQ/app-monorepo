import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type ISwapOwnedDialog = {
  close: () => void | Promise<void>;
};

export function useSwapModalAutoCloseOnBroadcast({
  enabled,
  isFocused,
  dialogRef,
  onPopStack,
  onBroadcast,
}: {
  enabled: boolean;
  isFocused: boolean;
  dialogRef: RefObject<ISwapOwnedDialog | null>;
  onPopStack: () => void;
  onBroadcast?: () => void | Promise<void>;
}) {
  const [dialogClosedForBroadcast, setDialogClosedForBroadcast] =
    useState(false);
  const mountedRef = useRef(false);
  const requestedRef = useRef(false);
  const notifiedReviewsRef = useRef(new Set<(() => boolean) | undefined>());
  const closingDialogRef = useRef<ISwapOwnedDialog | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onBroadcastRef = useRef(onBroadcast);
  onBroadcastRef.current = onBroadcast;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!dialogClosedForBroadcast || !isFocused) {
      return;
    }
    setDialogClosedForBroadcast(false);
    if (dialogRef.current !== closingDialogRef.current) {
      requestedRef.current = false;
      return;
    }
    onPopStack();
  }, [dialogClosedForBroadcast, dialogRef, isFocused, onPopStack]);

  return useCallback(
    async (isReviewCurrent?: () => boolean) => {
      if (
        !enabled ||
        !mountedRef.current ||
        notifiedReviewsRef.current.has(isReviewCurrent)
      ) {
        return;
      }
      notifiedReviewsRef.current.add(isReviewCurrent);
      const ownedDialog = dialogRef.current;
      try {
        await onBroadcastRef.current?.();
      } catch {
        // A caller acknowledgment cannot undo the broadcast or block cleanup.
      }
      if (
        !mountedRef.current ||
        requestedRef.current ||
        (isReviewCurrent && !isReviewCurrent()) ||
        dialogRef.current !== ownedDialog
      ) {
        return;
      }
      requestedRef.current = true;
      closingDialogRef.current = ownedDialog;
      try {
        await ownedDialog?.close();
      } catch {
        requestedRef.current = false;
        return;
      }
      if (mountedRef.current && enabledRef.current) {
        setDialogClosedForBroadcast(true);
      }
    },
    [dialogRef, enabled],
  );
}
