import { useCallback, useMemo } from 'react';

// import { useIntl } from 'react-intl';

// import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ButtonFrame, SizableText, XStack } from '../../primitives';
import { IconButton } from '../IconButton';

import type { IXStackProps } from '../../primitives';

const DOTS = 'DOTS';

function range(start: number, end: number) {
  if (start > end) {
    return [];
  }
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
  // const intl = useIntl();
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
          icon="ChevronLeftSmallOutline"
          disabled={disableControls || isFirstPage}
          onPress={onPrev}
          // title={intl.formatMessage({ id: ETranslations.global_previous })}
          title="Previous Page"
        />
      ) : null}
      {paginationRange.map((page, idx) => {
        if (page === DOTS) {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <SizableText
              key={idx === 1 ? 'dots-left' : 'dots-right'}
              color="$textSubdued"
            >
              ...
            </SizableText>
          );
        }
        const active = page === current;
        return (
          <ButtonFrame
            borderWidth={0}
            key={page}
            py="$1"
            px="$2.5"
            borderRadius="$2"
            borderCurve="continuous"
            userSelect="none"
            pressStyle={{ bg: '$bgActive' }}
            hoverStyle={{ bg: active ? '$bgStrong' : '$bgHover' }}
            bg={active ? '$bgStrong' : '$transparent'}
            onPress={() => onPageChange(page)}
            role="button"
            aria-label={`Page ${page}${active ? ', current page' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <SizableText
              size="$bodyMdMedium"
              textAlign="center"
              color={active ? '$text' : '$textSubdued'}
            >
              {page}
            </SizableText>
          </ButtonFrame>
        );
      })}
      {showControls ? (
        <IconButton
          variant="tertiary"
          size={pageButtonSize}
          icon="ChevronRightSmallOutline"
          disabled={disableControls || isLastPage}
          onPress={onNext}
          // title={intl.formatMessage({ id: ETranslations.global_next_page })}
          title="Next Page"
        />
      ) : null}
    </XStack>
  );
}

export const Pagination = PaginationFrame;
