import { useCallback } from 'react';

import { ButtonFrame, SizableText, XStack } from '../../primitives';
import { IconButton } from '../IconButton';

import { DOTS, usePagination } from './usePagination';

import type { IXStackProps } from '../../primitives';

export interface IPaginationProps extends IXStackProps {
  current: number;
  total: number;
  onChange?: (page: number) => void;
  siblingCount?: number;
  showControls?: boolean;
  disableControls?: boolean;
  pageButtonSize?: 'small' | 'medium' | 'large';
  maxPages?: number;
}

function PaginationFrame({
  current,
  total,
  onChange,
  siblingCount = 1,
  showControls = true,
  disableControls = false,
  pageButtonSize = 'small',
  maxPages,
  ...rest
}: IPaginationProps) {
  const { paginationRange, effectiveCurrent, effectiveTotal } = usePagination({
    current,
    total,
    siblingCount,
    maxPages,
    onChange,
  });

  const onPageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > effectiveTotal || page === effectiveCurrent)
        return;
      onChange?.(page);
    },
    [effectiveCurrent, onChange, effectiveTotal],
  );

  const onNext = useCallback(
    () => onPageChange(effectiveCurrent + 1),
    [effectiveCurrent, onPageChange],
  );
  const onPrev = useCallback(
    () => onPageChange(effectiveCurrent - 1),
    [effectiveCurrent, onPageChange],
  );

  const isFirstPage = effectiveCurrent === 1;
  const isLastPage = effectiveCurrent === effectiveTotal;

  return (
    <XStack alignItems="center" gap="$2" {...rest}>
      {showControls ? (
        <IconButton
          variant="tertiary"
          size={pageButtonSize}
          icon="ChevronLeftSmallOutline"
          disabled={disableControls || isFirstPage}
          onPress={onPrev}
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
        const active = page === effectiveCurrent;
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
          title="Next Page"
        />
      ) : null}
    </XStack>
  );
}

export const Pagination = PaginationFrame;
