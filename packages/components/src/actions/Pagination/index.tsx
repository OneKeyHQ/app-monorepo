import { useCallback, useMemo } from 'react';

import { SizableText, XStack, YStack } from '../../primitives';
import { IconButton } from '../IconButton';

import type { IXStackProps } from '../../primitives';

const DOTS = 'DOTS';

function range(start: number, end: number) {
  const length = end - start + 1;
  return Array.from({ length }, (_, idx) => idx + start);
}

function usePagination({
  current,
  total,
  siblingCount,
}: {
  current: number;
  total: number;
  siblingCount: number;
}) {
  return useMemo<(number | typeof DOTS)[]>(() => {
    // Pages count is less than the page numbers we want to show in pagination
    const totalPageNumbers = siblingCount * 2 + 5;

    if (totalPageNumbers >= total) {
      return range(1, total);
    }

    const leftSiblingIndex = Math.max(current - siblingCount, 1);
    const rightSiblingIndex = Math.min(current + siblingCount, total);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < total - 1;

    const firstPageIndex = 1;
    const lastPageIndex = total;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      // No left dots to show, but rights dots to be shown
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = range(1, leftItemCount);
      return [...leftRange, DOTS, lastPageIndex];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      // No right dots to show, but left dots to be shown
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = range(total - rightItemCount + 1, total);
      return [firstPageIndex, DOTS, ...rightRange];
    }

    // Both left and right dots to be shown
    const middleRange = range(leftSiblingIndex, rightSiblingIndex);
    return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
  }, [current, total, siblingCount]);
}

export interface IPaginationProps extends IXStackProps {
  current: number;
  total: number;
  onChange?: (page: number) => void;
  siblingCount?: number;
  showControls?: boolean;
  disableControls?: boolean;
  pageButtonSize?: 'small' | 'medium' | 'large';
}

function PaginationFrame({
  current,
  total,
  onChange,
  siblingCount = 1,
  showControls = true,
  disableControls = false,
  pageButtonSize = 'small',
  ...rest
}: IPaginationProps) {
  const paginationRange = usePagination({
    current,
    total,
    siblingCount,
  });

  const onPageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > total || page === current) return;
      onChange?.(page);
    },
    [current, onChange, total],
  );

  const onNext = useCallback(
    () => onPageChange(current + 1),
    [current, onPageChange],
  );
  const onPrev = useCallback(
    () => onPageChange(current - 1),
    [current, onPageChange],
  );

  const isFirstPage = current === 1;
  const isLastPage = current === total;

  return (
    <XStack alignItems="center" gap="$2" {...rest}>
      {showControls ? (
        <IconButton
          variant="tertiary"
          size={pageButtonSize}
          icon="ChevronLeftOutline"
          disabled={disableControls || isFirstPage}
          onPress={onPrev}
          title="Previous Page"
        />
      ) : null}
      {paginationRange.map((page, idx) => {
        if (page === DOTS) {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <SizableText key={`dots-${idx}`} color="$textSubdued">
              ...
            </SizableText>
          );
        }
        const active = page === current;
        return (
          <YStack
            key={page}
            py="$1"
            px="$2.5"
            borderRadius="$2"
            borderCurve="continuous"
            userSelect="none"
            pressStyle={{ bg: '$bgActive' }}
            hoverStyle={{ bg: active ? '$bgStrong' : '$bgHover' }}
            {...(active
              ? {
                  bg: '$bgStrong',
                }
              : {})}
            onPress={() => onPageChange(page)}
          >
            <SizableText
              size="$bodyMdMedium"
              textAlign="center"
              color={active ? '$text' : '$textSubdued'}
            >
              {page}
            </SizableText>
          </YStack>
        );
      })}
      {showControls ? (
        <IconButton
          variant="tertiary"
          size={pageButtonSize}
          icon="ChevronRightOutline"
          disabled={disableControls || isLastPage}
          onPress={onNext}
          title="Next Page"
        />
      ) : null}
    </XStack>
  );
}

export const Pagination = PaginationFrame;
