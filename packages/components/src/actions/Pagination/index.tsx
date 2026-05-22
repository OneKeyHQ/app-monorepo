import { useCallback } from 'react';

import { ButtonFrame, SizableText, XStack } from '../../primitives';
import { IconButton } from '../IconButton';

import { DOTS, usePagination } from './usePagination';

import type { IXStackProps } from '../../primitives';

const pressStyleConst = { bg: '$bgActive' } as const;
const activeHoverStyle = { bg: '$bgStrong' } as const;
const inactiveHoverStyle = { bg: '$bgHover' } as const;

function PageButton({
  page,
  active,
  onPageChange,
  testID,
}: {
  page: number;
  active: boolean;
  onPageChange: (page: number) => void;
  testID?: string;
}) {
  const handlePress = useCallback(() => {
    onPageChange(page);
  }, [onPageChange, page]);

  return (
    <ButtonFrame
      borderWidth={0}
      key={page}
      py="$1"
      px="$2.5"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      pressStyle={pressStyleConst}
      hoverStyle={active ? activeHoverStyle : inactiveHoverStyle}
      bg={active ? '$bgStrong' : '$transparent'}
      onPress={handlePress}
      role="button"
      aria-label={`Page ${page}${active ? ', current page' : ''}`}
      aria-current={active ? 'page' : undefined}
      testID={testID}
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
}

export interface IPaginationProps extends IXStackProps {
  current: number;
  total: number;
  onChange?: (page: number) => void;
  siblingCount?: number;
  showControls?: boolean;
  disableControls?: boolean;
  pageButtonSize?: 'small' | 'medium' | 'large';
  maxPages?: number;
  testID?: string;
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
  testID,
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
          testID={testID ? `${testID}-prev` : undefined}
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
          <PageButton
            key={page}
            page={page}
            active={active}
            onPageChange={onPageChange}
            testID={testID ? `${testID}-page-${page}` : undefined}
          />
        );
      })}
      {showControls ? (
        <IconButton
          variant="tertiary"
          size={pageButtonSize}
          icon="ChevronRightSmallOutline"
          disabled={disableControls || isLastPage}
          onPress={onNext}
          testID={testID ? `${testID}-next` : undefined}
        />
      ) : null}
    </XStack>
  );
}

export const Pagination = PaginationFrame;
