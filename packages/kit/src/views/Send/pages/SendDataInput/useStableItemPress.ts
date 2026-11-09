import { useCallback, useLayoutEffect, useRef } from 'react';

// Quick-select rows are memoized on their data alone, so a press handler handed
// to them must keep one identity for the life of the list while still seeing
// the caller's latest props. Without this, a row painted synchronously from the
// session cache keeps the closure from its first render; on the Send page that
// closure predates the vault settings and drops the memo/note on tap
// (OK-63928).
export function useStableItemPress<T>(
  handler: (item: T) => void | Promise<void>,
): (item: T) => void {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });
  return useCallback((item: T) => {
    void handlerRef.current(item);
  }, []);
}
