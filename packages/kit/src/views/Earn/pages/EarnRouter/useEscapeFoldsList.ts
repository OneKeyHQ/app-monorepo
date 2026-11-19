import { useEffect, useRef } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * While a list in the form is open, Escape folds it and the modal stays.
 * The modal closes as the key comes up (on the window), and the cursor can
 * be anywhere in the form (in the amount box after a click on its token),
 * so the press is taken before it gets there. onFold hears whether the
 * focus was in the list, to hand it back to the list's own trigger
 */
export function useEscapeFoldsList(
  isOpen: boolean,
  onFold: (wasFocusInList: boolean) => void,
  listRef: { current: unknown },
) {
  const onFoldRef = useRef(onFold);
  onFoldRef.current = onFold;
  useEffect(() => {
    if (!isOpen || !platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    const doc = globalThis.document;
    if (!doc) {
      return undefined;
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const list = listRef.current;
      const wasFocusInList =
        typeof HTMLElement !== 'undefined' &&
        list instanceof HTMLElement &&
        list.contains(doc.activeElement);
      onFoldRef.current(wasFocusInList);
    };
    doc.addEventListener('keyup', handleKeyUp, true);
    return () => doc.removeEventListener('keyup', handleKeyUp, true);
  }, [isOpen, listRef]);
}
