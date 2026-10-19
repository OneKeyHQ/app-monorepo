import { useMemo, useState } from 'react';

import {
  Button,
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
import type { IPool, IPoolTopPosition } from '@onekeyhq/shared/types/pools';

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

// Log distance shown on each side of the current price, at least and at most
const MIN_BAR_SPAN = Math.log(1.01);
const MAX_BAR_SPAN = Math.log(3);
const DAY_MS = 24 * 60 * 60 * 1000;

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

function formatAge(createdAt: number) {
  const days = Math.max(0, (Date.now() - createdAt) / DAY_MS);
  return POOLS_COPY.ageDays(
    days < 10 ? days.toFixed(1) : String(Math.round(days)),
  );
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
  width,
}: {
  min: number;
  max: number;
  current: number;
  span: number;
  inRange: boolean;
  width: number;
}) {
  const left = getRangeBarPosition(min, current, span);
  const right = Number.isFinite(max)
    ? getRangeBarPosition(max, current, span)
    : 1;
  return (
    <Stack w={width} h="$3" jc="center" flexShrink={0}>
      <Stack h="$1" borderRadius="$full" bg="$neutral4" />
      <Stack
        position="absolute"
        left={left * width}
        w={Math.max(3, (right - left) * width)}
        h="$1"
        borderRadius="$full"
        bg={inRange ? '$iconSuccess' : '$iconCaution'}
      />
      <Stack
        position="absolute"
        left={width / 2 - 1}
        w={2}
        h="$3"
        borderRadius="$full"
        bg="$text"
      />
    </Stack>
  );
}

function CopyRangeButton({
  onPress,
  testID,
}: {
  onPress: () => void;
  testID: string;
}) {
  return (
    <Button
      testID={testID}
      size="small"
      variant="secondary"
      icon="Copy3Outline"
      onPress={onPress}
    >
      {POOLS_COPY.copyRange}
    </Button>
  );
}

type IShownTopPosition = IPoolTopPosition & {
  shown: { min: number; max: number; full: boolean };
};

/** The range in numbers over its bar; a range the price has left says so */
function RangeCell({
  row,
  current,
  span,
  barWidth,
}: {
  row: IShownTopPosition;
  current: number;
  span: number;
  barWidth: number;
}) {
  return (
    <YStack gap="$1.5" minWidth={0}>
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {formatRangeText(row.shown)}
      </SizableText>
      <XStack ai="center" gap="$2">
        <RangeMiniBar
          min={row.shown.min}
          max={row.shown.max}
          current={current}
          span={span}
          inRange={row.inRange}
          width={barWidth}
        />
        {row.inRange ? null : (
          <SizableText size="$bodySm" color="$textCaution" flexShrink={0}>
            {POOLS_COPY.outOfRange}
          </SizableText>
        )}
      </XStack>
    </YStack>
  );
}

function TableRows({
  rows,
  current,
  span,
  onCopy,
}: {
  rows: IShownTopPosition[];
  current: number;
  span: number;
  onCopy: (row: IShownTopPosition) => void;
}) {
  return (
    <YStack>
      <XStack gap="$3" pb="$2" ai="center">
        <SizableText flex={3} size="$bodySmMedium" color="$textSubdued">
          {POOLS_COPY.range}
        </SizableText>
        <SizableText
          flex={1.2}
          size="$bodySmMedium"
          color="$textSubdued"
          textAlign="right"
        >
          {POOLS_COPY.positionValue}
        </SizableText>
        <SizableText
          flex={1}
          size="$bodySmMedium"
          color="$textSubdued"
          textAlign="right"
        >
          {POOLS_COPY.apr}
        </SizableText>
        <SizableText
          flex={1.2}
          size="$bodySmMedium"
          color="$textSubdued"
          textAlign="right"
        >
          {POOLS_COPY.earned}
        </SizableText>
        <SizableText
          flex={0.8}
          size="$bodySmMedium"
          color="$textSubdued"
          textAlign="right"
        >
          {POOLS_COPY.age}
        </SizableText>
        <Stack w={128} />
      </XStack>
      {rows.map((row) => (
        <XStack
          key={row.id}
          testID={`earn-pool-top-position-${row.tokenId}`}
          gap="$3"
          py="$2.5"
          ai="center"
          borderTopWidth={1}
          borderTopColor="$borderSubdued"
        >
          <YStack flex={3} minWidth={0}>
            <RangeCell row={row} current={current} span={span} barWidth={96} />
          </YStack>
          <SizableText
            flex={1.2}
            size="$bodyMd"
            textAlign="right"
            numberOfLines={1}
          >
            {formatCompactUsd(row.valueUsd)}
          </SizableText>
          <SizableText flex={1} size="$bodyMdMedium" textAlign="right">
            {formatPercent(row.apr, 1)}
          </SizableText>
          <SizableText
            flex={1.2}
            size="$bodyMd"
            color="$textSuccess"
            textAlign="right"
            numberOfLines={1}
          >
            {`+${formatCompactUsd(row.feesEarnedUsd)}`}
          </SizableText>
          <SizableText
            flex={0.8}
            size="$bodyMd"
            color="$textSubdued"
            textAlign="right"
          >
            {formatAge(row.createdAt)}
          </SizableText>
          <XStack w={128} jc="flex-end">
            <CopyRangeButton
              testID={`earn-pool-copy-range-${row.tokenId}`}
              onPress={() => onCopy(row)}
            />
          </XStack>
        </XStack>
      ))}
    </YStack>
  );
}

function ListRows({
  rows,
  current,
  span,
  onCopy,
}: {
  rows: IShownTopPosition[];
  current: number;
  span: number;
  onCopy: (row: IShownTopPosition) => void;
}) {
  return (
    <YStack>
      {rows.map((row, index) => (
        <YStack
          key={row.id}
          testID={`earn-pool-top-position-${row.tokenId}`}
          gap="$2"
          py="$3"
          borderTopWidth={index ? 1 : 0}
          borderTopColor="$borderSubdued"
        >
          <XStack ai="center" jc="space-between" gap="$3">
            <YStack flex={1} minWidth={0}>
              <RangeCell
                row={row}
                current={current}
                span={span}
                barWidth={96}
              />
            </YStack>
            <CopyRangeButton
              testID={`earn-pool-copy-range-${row.tokenId}`}
              onPress={() => onCopy(row)}
            />
          </XStack>
          <XStack gap="$4" flexWrap="wrap">
            <SizableText size="$bodySm" color="$textSubdued">
              {`${POOLS_COPY.apr} `}
              <SizableText size="$bodySmMedium" color="$text">
                {formatPercent(row.apr, 1)}
              </SizableText>
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`${POOLS_COPY.positionValue} `}
              <SizableText size="$bodySmMedium" color="$text">
                {formatCompactUsd(row.valueUsd)}
              </SizableText>
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`${POOLS_COPY.earned} `}
              <SizableText size="$bodySmMedium" color="$textSuccess">
                {`+${formatCompactUsd(row.feesEarnedUsd)}`}
              </SizableText>
            </SizableText>
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}

/**
 * Other LPs' ranges in this pool, best earners first (Revert's Top
 * positions). Each can be copied into the create form.
 */
export function PoolTopPositions({
  pool,
  layout,
  onCopyRange,
}: {
  pool: IPool;
  layout: 'table' | 'list';
  onCopyRange: (range: IPoolTickRange) => void;
}) {
  const [limit, setLimit] = useState(TOP_POSITIONS_PAGE_SIZE);
  const { result: page } = usePoolsQuery(
    PoolsQueries.topPositions(pool.id, limit),
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

  let body;
  if (!page) {
    body = (
      <YStack gap="$3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} w="100%" h="$8" borderRadius="$2" />
        ))}
      </YStack>
    );
  } else if (!rows.length) {
    body = (
      <SizableText size="$bodyMd" color="$textSubdued">
        {POOLS_COPY.noTopPositions(formatCompactUsd(page.minValueUsd))}
      </SizableText>
    );
  } else if (layout === 'table') {
    body = (
      <TableRows rows={rows} current={current} span={span} onCopy={copy} />
    );
  } else {
    body = <ListRows rows={rows} current={current} span={span} onCopy={copy} />;
  }

  const hint = page ? (
    <SizableText size="$bodySm" color="$textSubdued">
      {POOLS_COPY.topPositionsHint(formatCompactUsd(page.minValueUsd))}
    </SizableText>
  ) : null;
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
      {body}
      {page && page.total > rows.length ? (
        <Button
          testID="earn-pool-top-positions-more"
          size="small"
          variant="tertiary"
          alignSelf="center"
          onPress={() => setLimit((value) => value + TOP_POSITIONS_PAGE_SIZE)}
        >
          {POOLS_COPY.showMore}
        </Button>
      ) : null}
    </PoolsCard>
  );
}
