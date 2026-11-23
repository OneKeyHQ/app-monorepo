import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  Button,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  getDisplayRange,
  isFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTopPosition,
  IPoolTopPositionsSortKey,
} from '@onekeyhq/shared/types/pools';

import { getRangeBarPosition } from '../poolsChartData';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatCompactUsd,
  formatPercent,
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
} from '../poolsFormat';
import {
  PoolsQueries,
  TOP_POSITIONS_PAGE_SIZE,
  usePoolsQuery,
} from '../poolsQueries';

import { PoolsCard } from './PoolsCard';
import { PoolsSortHeader } from './PoolsSortHeader';

// Log distance shown on each side of the current price, at least and at most
const MIN_BAR_SPAN = Math.log(1.01);
const MAX_BAR_SPAN = Math.log(3);
const DAY_MS = 24 * 60 * 60 * 1000;
const BAR_WIDTH = 96;
// The copy button's column, so the header's columns line up with the rows'
const COPY_COLUMN_WIDTH = 32;
// Under this the table's shares cut its figures short ("+$364…"), so the
// rows a phone gets are used instead: figures first, the range under them
const TABLE_MIN_WIDTH = 640;
// Column widths, as flex shares
const COLUMN_FLEX = { apr: 1, value: 1, earned: 1.2, openFor: 1, range: 2.6 };

function getShownRange(pool: IPool, position: IPoolTopPosition) {
  const display = getDisplayRange({
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    tickSpacing: pool.tickSpacing ?? 60,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
    inverted: getPoolPair(pool).inverted,
  });
  return {
    min: display.isMinZero ? 0 : display.min.toNumber(),
    max: display.isMaxInfinite
      ? Number.POSITIVE_INFINITY
      : display.max.toNumber(),
    full: isFullRange({
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      tickSpacing: pool.tickSpacing ?? 60,
    }),
  };
}

function formatRangeText(range: { min: number; max: number; full: boolean }) {
  if (range.full) {
    return POOLS_COPY.fullRange;
  }
  const min = range.min > 0 ? formatTokenPrice(range.min) : '0';
  const max = Number.isFinite(range.max) ? formatTokenPrice(range.max) : '∞';
  return `${min} – ${max}`;
}

function formatOpenFor(createdAt: number) {
  const days = Math.max(0, (Date.now() - createdAt) / DAY_MS);
  return POOLS_COPY.openDays(days < 1 ? 0 : Math.round(days));
}

/**
 * The range on a bar centred on the current price, as Revert draws it: the
 * segment is green while the price is inside, amber once it has left.
 */
function RangeMiniBar({
  min,
  max,
  current,
  span,
  inRange,
}: {
  min: number;
  max: number;
  current: number;
  span: number;
  inRange: boolean;
}) {
  const left = getRangeBarPosition(min, current, span);
  const right = Number.isFinite(max)
    ? getRangeBarPosition(max, current, span)
    : 1;
  return (
    <Stack w={BAR_WIDTH} h="$3" jc="center" flexShrink={0}>
      <Stack h="$1" borderRadius="$full" bg="$neutral4" />
      <Stack
        position="absolute"
        left={left * BAR_WIDTH}
        w={Math.max(3, (right - left) * BAR_WIDTH)}
        h="$1"
        borderRadius="$full"
        bg={inRange ? '$iconSuccess' : '$iconCaution'}
      />
      <Stack
        position="absolute"
        left={BAR_WIDTH / 2 - 1}
        w={2}
        h="$3"
        borderRadius="$full"
        bg="$text"
      />
    </Stack>
  );
}

type IShownTopPosition = IPoolTopPosition & {
  shown: { min: number; max: number; full: boolean };
};

/** The range's bar, and the range's state when it has stopped earning */
function RangeLine({
  row,
  current,
  span,
  children,
}: {
  row: IShownTopPosition;
  current: number;
  span: number;
  children?: ReactNode;
}) {
  return (
    <XStack ai="center" gap="$2" minWidth={0}>
      <RangeMiniBar
        min={row.shown.min}
        max={row.shown.max}
        current={current}
        span={span}
        inRange={row.inRange}
      />
      {row.inRange ? null : (
        <SizableText
          size="$bodySm"
          color="$textCaution"
          flexShrink={1}
          numberOfLines={1}
        >
          {POOLS_COPY.outOfRange}
        </SizableText>
      )}
      {children}
    </XStack>
  );
}

function CopyRangeButton({
  row,
  onCopy,
}: {
  row: IShownTopPosition;
  onCopy: (row: IShownTopPosition) => void;
}) {
  // A fixed column: a tertiary button's negative margins would otherwise
  // give the row's figures more room than the header's
  return (
    <XStack w={COPY_COLUMN_WIDTH} jc="flex-end" flexShrink={0}>
      <IconButton
        testID={`earn-pool-copy-range-${row.tokenId}`}
        size="small"
        variant="tertiary"
        icon="Copy3Outline"
        title={POOLS_COPY.copyRange}
        aria-label={POOLS_COPY.copyRange}
        onPress={() => onCopy(row)}
      />
    </XStack>
  );
}

function SortHeaders({
  sortKey,
  onSort,
}: {
  sortKey: IPoolTopPositionsSortKey;
  onSort: (key: IPoolTopPositionsSortKey) => void;
}) {
  const header = (
    key: IPoolTopPositionsSortKey,
    label: string,
    align: 'left' | 'right',
  ) => (
    <PoolsSortHeader
      label={label}
      sortKey={key}
      activeKey={sortKey}
      direction="desc"
      descendingOnly
      align={align}
      onSort={(next) => onSort(next)}
      testID={`earn-pool-top-positions-sort-${key}`}
      flex={COLUMN_FLEX[key]}
    />
  );
  return (
    <>
      {header('apr', POOLS_COPY.apr, 'left')}
      {header('value', POOLS_COPY.positionValue, 'right')}
      {header('earned', POOLS_COPY.earned, 'right')}
    </>
  );
}

/** APR, value and what it earned lead each row; its range is secondary */
function RowFigures({ row }: { row: IShownTopPosition }) {
  return (
    <>
      <SizableText
        flex={COLUMN_FLEX.apr}
        flexBasis={0}
        size="$bodyLgMedium"
        numberOfLines={1}
      >
        {formatPercent(row.apr)}
      </SizableText>
      <SizableText
        flex={COLUMN_FLEX.value}
        flexBasis={0}
        size="$bodyLgMedium"
        textAlign="right"
        numberOfLines={1}
      >
        {formatCompactUsd(row.valueUsd)}
      </SizableText>
      <SizableText
        flex={COLUMN_FLEX.earned}
        flexBasis={0}
        size="$bodyLgMedium"
        color="$textSuccess"
        textAlign="right"
        numberOfLines={1}
      >
        {`+${formatCompactUsd(row.feesEarnedUsd)}`}
      </SizableText>
    </>
  );
}

type IRowsProps = {
  rows: IShownTopPosition[];
  current: number;
  span: number;
  sortKey: IPoolTopPositionsSortKey;
  onSort: (key: IPoolTopPositionsSortKey) => void;
  onCopy: (row: IShownTopPosition) => void;
};

/** Wide: how long each has been open, and its range in numbers over its bar */
function TableRows({
  rows,
  current,
  span,
  sortKey,
  onSort,
  onCopy,
}: IRowsProps) {
  return (
    <YStack>
      <XStack gap="$4" pb="$2" ai="center">
        <SortHeaders sortKey={sortKey} onSort={onSort} />
        <SizableText
          flex={COLUMN_FLEX.openFor}
          flexBasis={0}
          size="$bodySmMedium"
          color="$textSubdued"
          textAlign="right"
          numberOfLines={1}
        >
          {POOLS_COPY.openFor}
        </SizableText>
        <SizableText
          flex={COLUMN_FLEX.range}
          flexBasis={0}
          pl="$4"
          size="$bodySmMedium"
          color="$textSubdued"
          numberOfLines={1}
        >
          {POOLS_COPY.range}
        </SizableText>
        <Stack w={COPY_COLUMN_WIDTH} />
      </XStack>
      {rows.map((row) => (
        <XStack
          key={row.id}
          testID={`earn-pool-top-position-${row.tokenId}`}
          gap="$4"
          py="$3"
          ai="center"
          borderTopWidth={1}
          borderTopColor="$borderSubdued"
        >
          <RowFigures row={row} />
          <SizableText
            flex={COLUMN_FLEX.openFor}
            flexBasis={0}
            size="$bodyMd"
            color="$textSubdued"
            textAlign="right"
            numberOfLines={1}
          >
            {formatOpenFor(row.createdAt)}
          </SizableText>
          <YStack flex={COLUMN_FLEX.range} flexBasis={0} pl="$4" gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {formatRangeText(row.shown)}
            </SizableText>
            <RangeLine row={row} current={current} span={span} />
          </YStack>
          <CopyRangeButton row={row} onCopy={onCopy} />
        </XStack>
      ))}
    </YStack>
  );
}

/** Narrow: the three figures, with the range's bar and age under them */
function ListRows({
  rows,
  current,
  span,
  sortKey,
  onSort,
  onCopy,
}: IRowsProps) {
  return (
    <YStack>
      <XStack gap="$3" pb="$2" ai="center">
        <XStack flex={1} gap="$3" ai="center">
          <SortHeaders sortKey={sortKey} onSort={onSort} />
        </XStack>
        <Stack w={COPY_COLUMN_WIDTH} />
      </XStack>
      {rows.map((row) => (
        <XStack
          key={row.id}
          testID={`earn-pool-top-position-${row.tokenId}`}
          gap="$3"
          py="$3"
          ai="center"
          borderTopWidth={1}
          borderTopColor="$borderSubdued"
        >
          <YStack flex={1} minWidth={0} gap="$1.5">
            <XStack gap="$3" ai="center">
              <RowFigures row={row} />
            </XStack>
            <RangeLine row={row} current={current} span={span}>
              <SizableText
                flex={1}
                size="$bodySm"
                color="$textSubdued"
                textAlign="right"
                numberOfLines={1}
              >
                {formatOpenFor(row.createdAt)}
              </SizableText>
            </RangeLine>
          </YStack>
          <CopyRangeButton row={row} onCopy={onCopy} />
        </XStack>
      ))}
    </YStack>
  );
}

/**
 * Other LPs' open positions in this pool, ranked by APR, value or what they
 * earned (Revert's Top positions); any one's range can be copied into the
 * create form. `tab` is a pool page's tab, which names it already; `card`
 * is an opened row's block.
 */
export function PoolTopPositions({
  pool,
  layout,
  onCopyRange,
  variant = 'card',
}: {
  pool: IPool;
  layout: 'table' | 'list';
  onCopyRange: (range: IPoolTickRange) => void;
  variant?: 'card' | 'tab';
}) {
  const [limit, setLimit] = useState(TOP_POSITIONS_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<IPoolTopPositionsSortKey>('apr');
  const { result: page } = usePoolsQuery(
    PoolsQueries.topPositions(pool.id, limit, sortKey),
  );
  const current = getPoolDisplayPrice(pool).toNumber();

  const rows = useMemo<IShownTopPosition[]>(
    () =>
      (page?.items ?? []).map((item) => ({
        ...item,
        shown: getShownRange(pool, item),
      })),
    [page?.items, pool],
  );
  // One scale for every row, so ranges compare at a glance
  const span = useMemo(() => {
    const distances = rows.flatMap(({ shown }) =>
      shown.full
        ? []
        : [
            shown.min > 0
              ? Math.abs(Math.log(current / shown.min))
              : MAX_BAR_SPAN,
            Number.isFinite(shown.max)
              ? Math.abs(Math.log(shown.max / current))
              : MAX_BAR_SPAN,
          ],
    );
    const widest = distances.length ? Math.max(...distances) : MAX_BAR_SPAN;
    return Math.min(MAX_BAR_SPAN, Math.max(MIN_BAR_SPAN, widest * 1.15));
  }, [current, rows]);

  const copy = (row: IShownTopPosition) =>
    onCopyRange({ tickLower: row.tickLower, tickUpper: row.tickUpper });

  // The room the rows really get: beside a create card it is far less than
  // the window. Measured around the skeleton too, so rows start out right.
  const [bodyWidth, setBodyWidth] = useState<number>();
  const rowsLayout =
    layout === 'table' && bodyWidth !== undefined && bodyWidth < TABLE_MIN_WIDTH
      ? 'list'
      : layout;

  let body;
  if (!page) {
    body = (
      <YStack gap="$3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} w="100%" h="$10" borderRadius="$2" />
        ))}
      </YStack>
    );
  } else if (!rows.length) {
    body = (
      <SizableText size="$bodyMd" color="$textSubdued">
        {POOLS_COPY.noTopPositions(formatCompactUsd(page.minValueUsd))}
      </SizableText>
    );
  } else {
    const Rows = rowsLayout === 'table' ? TableRows : ListRows;
    body = (
      <Rows
        rows={rows}
        current={current}
        span={span}
        sortKey={sortKey}
        onSort={setSortKey}
        onCopy={copy}
      />
    );
  }

  const measuredBody = (
    <YStack onLayout={(event) => setBodyWidth(event.nativeEvent.layout.width)}>
      {body}
    </YStack>
  );

  const hint = page ? (
    <SizableText
      size={variant === 'tab' ? '$bodyMd' : '$bodySm'}
      color="$textSubdued"
    >
      {POOLS_COPY.topPositionsHint(formatCompactUsd(page.minValueUsd))}
    </SizableText>
  ) : null;
  const more =
    page && page.total > rows.length ? (
      <Button
        testID="earn-pool-top-positions-more"
        size="small"
        variant="tertiary"
        alignSelf="center"
        onPress={() => setLimit((value) => value + TOP_POSITIONS_PAGE_SIZE)}
      >
        {POOLS_COPY.showMore}
      </Button>
    ) : null;

  if (variant === 'tab') {
    return (
      <YStack testID="earn-pool-top-positions" gap="$4">
        {hint}
        {measuredBody}
        {more}
      </YStack>
    );
  }
  // Wide cards put the hint beside the title; narrow ones under it
  return (
    <PoolsCard
      testID="earn-pool-top-positions"
      title={layout === 'table' ? POOLS_COPY.topPositions : undefined}
      right={layout === 'table' ? hint : undefined}
    >
      {layout === 'table' ? null : (
        <YStack gap="$1">
          <SizableText size="$headingMd">{POOLS_COPY.topPositions}</SizableText>
          {hint}
        </YStack>
      )}
      {measuredBody}
      {more}
    </PoolsCard>
  );
}
