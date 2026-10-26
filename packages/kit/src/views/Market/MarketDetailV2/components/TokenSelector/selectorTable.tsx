import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DashText,
  Icon,
  NumberSizeableText,
  SizableText,
  Spinner,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import {
  TOKEN_SELECTOR_COLUMN_PADDING,
  TOKEN_SELECTOR_HEADER_HEIGHT,
  TOKEN_SELECTOR_NAME_COLUMN_WIDTH,
  TOKEN_SELECTOR_NAME_GAP,
  TOKEN_SELECTOR_STAR_COLUMN_WIDTH,
} from './constants';

export type ISelectorSortOrder = 'asc' | 'desc';

export interface ISelectorHeaderCell {
  key: string;
  /** Omitted for a spacer that only keeps the columns aligned. */
  label?: string;
  /** Shown on a dashed label, like the Market Stocks table's price header. */
  tooltip?: string;
  flex?: number;
  /** Present on sortable columns; `undefined` order means unsorted. */
  sort?: {
    order?: ISelectorSortOrder;
    onPress: () => void;
  };
}

function SortIcon({ order }: { order?: ISelectorSortOrder }) {
  let name:
    | 'ChevronGrabberVerOutline'
    | 'ChevronDownSmallOutline'
    | 'ChevronTopSmallOutline' = 'ChevronGrabberVerOutline';
  if (order === 'desc') {
    name = 'ChevronDownSmallOutline';
  } else if (order === 'asc') {
    name = 'ChevronTopSmallOutline';
  }
  return <Icon name={name} color="$iconSubdued" size="$3.5" />;
}

function HeaderLabel({ cell }: { cell: ISelectorHeaderCell }) {
  if (!cell.label) {
    return null;
  }
  // Header labels are not text to select: a sortable one shows the pointer,
  // the rest the default arrow, like the Market tables.
  const cursor = cell.sort ? 'pointer' : 'default';
  if (cell.tooltip) {
    return (
      <Tooltip
        placement="top"
        hovering
        renderTrigger={
          <DashText
            color="$textSubdued"
            size="$bodySmMedium"
            dashThickness={0.5}
            dashSpacing={0}
            dashColor="$neutral8"
            dashOverlay
            cursor={cursor}
            userSelect="none"
          >
            {cell.label}
          </DashText>
        }
        renderContent={<SizableText size="$bodySm">{cell.tooltip}</SizableText>}
      />
    );
  }
  return (
    <SizableText
      size="$bodySmMedium"
      color="$textSubdued"
      numberOfLines={1}
      cursor={cursor}
      userSelect="none"
    >
      {cell.label}
    </SizableText>
  );
}

/**
 * The column header every selector table shares: "#" over the star slot, the
 * name column, then flex metric columns. Rendered inside the list's content box
 * so a scrollbar that takes layout width shrinks header and rows alike.
 */
function BasicSelectorTableHeader({
  nameTitle,
  cells,
  nameColumnWidth = TOKEN_SELECTOR_NAME_COLUMN_WIDTH,
}: {
  nameTitle: string;
  cells: ISelectorHeaderCell[];
  nameColumnWidth?: number;
}) {
  return (
    <XStack
      width="100%"
      height={TOKEN_SELECTOR_HEADER_HEIGHT}
      alignItems="center"
      // Sticky headers scroll over the rows, so the header needs the popover
      // panel background to stay opaque.
      bg="$bg"
      cursor="default"
      userSelect="none"
    >
      <XStack
        width={nameColumnWidth}
        flexShrink={0}
        px={TOKEN_SELECTOR_COLUMN_PADDING}
        alignItems="center"
        gap={TOKEN_SELECTOR_NAME_GAP}
      >
        <SizableText
          width={TOKEN_SELECTOR_STAR_COLUMN_WIDTH}
          textAlign="center"
          size="$bodySmMedium"
          color="$textSubdued"
          cursor="default"
          userSelect="none"
        >
          #
        </SizableText>
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          cursor="default"
          userSelect="none"
        >
          {nameTitle}
        </SizableText>
      </XStack>
      {cells.map((cell) => (
        <XStack
          key={cell.key}
          flex={cell.flex ?? 1}
          flexBasis={0}
          minWidth={0}
          px={TOKEN_SELECTOR_COLUMN_PADDING}
          alignItems="center"
          // Figures read right-aligned; only the name column stays left.
          justifyContent="flex-end"
          gap="$0.5"
          cursor={cell.sort ? 'pointer' : 'default'}
          onPress={cell.sort?.onPress}
        >
          {/* The chevron leads, as in the shared Table's right-aligned
              headers, so the label ends flush with the figures below. */}
          {cell.sort ? <SortIcon order={cell.sort.order} /> : null}
          <HeaderLabel cell={cell} />
        </XStack>
      ))}
    </XStack>
  );
}

export const SelectorTableHeader = memo(BasicSelectorTableHeader);

/**
 * Price over its change, the search tables' combined column (Figma
 * 27019:37530). `change` is `undefined` when the feed has no change data.
 */
export function SelectorPriceChangeCell({
  price,
  change,
}: {
  price?: number;
  change?: number;
}) {
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange: change ?? 0,
  });
  const hasPrice = price !== undefined && Number.isFinite(price);
  const hasChange = change !== undefined && Number.isFinite(change);
  return (
    <YStack gap="$1" justifyContent="center" alignItems="flex-end" minWidth={0}>
      {hasPrice ? (
        <NumberSizeableText
          size="$bodyMdMedium"
          numberOfLines={1}
          formatter={price > 1_000_000 ? 'marketCap' : 'price'}
          formatterOptions={{ currency: '$', capAtMaxT: true }}
        >
          {String(price)}
        </NumberSizeableText>
      ) : (
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          --
        </SizableText>
      )}
      {hasChange ? (
        <NumberSizeableText
          size="$bodySm"
          color={changeColor}
          numberOfLines={1}
          formatter="priceChangeCapped"
          formatterOptions={{ showPlusMinusSigns }}
        >
          {String(change)}
        </NumberSizeableText>
      ) : (
        <SizableText size="$bodySm" color="$textSubdued">
          --
        </SizableText>
      )}
    </YStack>
  );
}

/** A single compact amount ($1.2M style), or `--` when there is none. */
export function SelectorAmountCell({ value }: { value?: number }) {
  return value ? (
    <NumberSizeableText
      size="$bodyMdMedium"
      numberOfLines={1}
      formatter="marketCap"
      formatterOptions={{ currency: '$', capAtMaxT: true }}
    >
      {String(value)}
    </NumberSizeableText>
  ) : (
    <SizableText size="$bodyMdMedium" color="$textSubdued">
      --
    </SizableText>
  );
}

/** Next state of a sortable header: descending, ascending, then the default. */
export function getNextSelectorSortOrder(
  order?: ISelectorSortOrder,
): ISelectorSortOrder | undefined {
  if (!order) {
    return 'desc';
  }
  return order === 'desc' ? 'asc' : undefined;
}

/**
 * Sorts loaded rows by a numeric field without refetching; rows with no value
 * always go last whatever the direction.
 */
export function sortSelectorRows<T>(
  rows: T[],
  getValue: (row: T) => number | undefined,
  order?: ISelectorSortOrder,
): T[] {
  if (!order) {
    return rows;
  }
  const direction = order === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .toSorted((a, b) => {
      const aMissing = !a.value || !Number.isFinite(a.value);
      const bMissing = !b.value || !Number.isFinite(b.value);
      if (aMissing || bMissing) {
        if (aMissing && bMissing) return a.index - b.index;
        return aMissing ? 1 : -1;
      }
      const diff = ((a.value as number) - (b.value as number)) * direction;
      return diff === 0 ? a.index - b.index : diff;
    })
    .map(({ row }) => row);
}

/** The spinner or retry under a stock list that pages as All scrolls. */
export function StockLoadMoreFooter({
  isLoadingMore,
  isLoadMoreError,
  onRetry,
  testID,
}: {
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  onRetry: () => void;
  testID: string;
}) {
  const intl = useIntl();
  if (isLoadingMore) {
    return (
      <YStack py="$4" alignItems="center">
        <Spinner size="small" />
      </YStack>
    );
  }
  if (isLoadMoreError) {
    return (
      <YStack py="$2" alignItems="center">
        <Button
          testID={testID}
          size="small"
          variant="tertiary"
          onPress={onRetry}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }
  return null;
}
