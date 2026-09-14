import { useCallback, useState } from 'react';

import { keyTagRowSide } from './utils';

// Which row the docked row pad edits, and which face of the tag is showing.
// The two are coupled — stepping past row 12 has to flip the plate — so they
// live together here instead of being re-derived by every page that renders
// the input surface.
export function useKeyTagActiveRow({ rowCount }: { rowCount: number }) {
  const [activeRow, setActiveRowState] = useState(0);
  const [side, setSide] = useState<'front' | 'back'>('front');

  // Focus a row and show the face it is engraved on.
  const focusRow = useCallback((rowIndex: number) => {
    setActiveRowState(rowIndex);
    setSide(keyTagRowSide(rowIndex));
  }, []);

  // Move by one row, clamped at both ends. Reads the previous row from the
  // updater so the callback identity does not change on every step.
  const stepRow = useCallback(
    (delta: 1 | -1) => {
      setActiveRowState((prev) => {
        const next = prev + delta;
        if (next < 0 || next >= rowCount) {
          return prev;
        }
        setSide(keyTagRowSide(next));
        return next;
      });
    },
    [rowCount],
  );

  // Back to row 1, front face — used whenever the row set is rebuilt.
  const resetRow = useCallback(() => {
    setActiveRowState(0);
    setSide('front');
  }, []);

  return { activeRow, side, setSide, focusRow, stepRow, resetRow };
}
