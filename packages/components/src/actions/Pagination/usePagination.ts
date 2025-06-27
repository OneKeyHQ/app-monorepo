import { useEffect, useMemo, useRef } from 'react';

const DOTS = 'DOTS';

function range(start: number, end: number) {
  if (start > end) {
    return [];
  }
  const length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
}

export function usePagination({
  current,
  total,
  siblingCount,
  maxPages,
  onChange,
}: {
  current: number;
  total: number;
  siblingCount: number;
  maxPages?: number;
  onChange?: (page: number) => void;
}) {
  // Calculate effective total pages, ensuring maxPages is at least 1 to prevent pagination errors
  const effectiveTotal = maxPages
    ? Math.min(total, Math.max(maxPages, 1))
    : total;

  // Ensure current page doesn't exceed the effective total pages
  const effectiveCurrent = Math.min(current, effectiveTotal);

  // Store the latest onChange callback in a ref to avoid dependency issues
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Auto-sync parent state when current exceeds effectiveTotal
  useEffect(() => {
    if (current !== effectiveCurrent && onChangeRef.current) {
      onChangeRef.current(effectiveCurrent);
    }
  }, [current, effectiveCurrent]);

  const paginationRange = useMemo<(number | typeof DOTS)[]>(() => {
    // Pages count is less than the page numbers we want to show in pagination
    const totalPageNumbers = siblingCount * 2 + 5;

    if (totalPageNumbers >= effectiveTotal) {
      return range(1, effectiveTotal);
    }

    const leftSiblingIndex = Math.max(effectiveCurrent - siblingCount, 1);
    const rightSiblingIndex = Math.min(
      effectiveCurrent + siblingCount,
      effectiveTotal,
    );

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < effectiveTotal - 1;

    const firstPageIndex = 1;
    const lastPageIndex = effectiveTotal;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      // No left dots to show, but rights dots to be shown
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = range(1, leftItemCount);
      return [...leftRange, DOTS, lastPageIndex];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      // No right dots to show, but left dots to be shown
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = range(
        effectiveTotal - rightItemCount + 1,
        effectiveTotal,
      );
      return [firstPageIndex, DOTS, ...rightRange];
    }

    // Both left and right dots to be shown
    const middleRange = range(leftSiblingIndex, rightSiblingIndex);
    return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
  }, [effectiveCurrent, effectiveTotal, siblingCount]);

  return {
    paginationRange,
    effectiveCurrent,
    effectiveTotal,
  };
}

export { DOTS };
