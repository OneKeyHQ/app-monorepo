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
    onPopStack();
  }, [dialogClosedForBroadcast, isFocused, onPopStack]);

  return useCallback(async () => {
    if (!enabled || !mountedRef.current || requestedRef.current) {
      return;
    }
    requestedRef.current = true;
    try {
      await onBroadcastRef.current?.();
    } catch {
      // A caller acknowledgment cannot undo the broadcast or block cleanup.
    }
    try {
      await dialogRef.current?.close();
    } catch {
      requestedRef.current = false;
      return;
    }
    if (mountedRef.current && enabledRef.current) {
      setDialogClosedForBroadcast(true);
    }
  }, [dialogRef, enabled]);
}
