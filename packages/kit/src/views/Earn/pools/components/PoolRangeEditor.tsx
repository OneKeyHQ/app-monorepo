import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  IconButton,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  displayPriceToTick,
  getDisplayRange,
  getRangeAroundPrice,
  getRangeSideForDisplayBound,
  stepDisplayBound,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPoolTickRange,
  IRangeDisplayBound,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
  getPriceUnitLabel,
} from '../poolsFormat';

import { PoolLiquidityChart } from './PoolLiquidityChart';
import { PoolsChip } from './PoolsFilterButton';

export type IPoolRangePreset = { id: string; label: string; percent: number };

/** Doc §3.3: ±10/20/50% for volatile pairs, ±0.1/0.5/1% for stable pairs */
export function getRangePresets(pool: IPool): IPoolRangePreset[] {
  const isStablePair =
    pool.token0.category === 'stablecoin' &&
    pool.token1.category === 'stablecoin';
  const percents = isStablePair ? [0.001, 0.005, 0.01] : [0.1, 0.2, 0.5];
  return [
    ...percents.map((percent) => ({
      id: String(percent),
      label: `±${new BigNumber(percent).times(100).toFixed()}%`,
      percent,
    })),
    { id: 'full', label: POOLS_COPY.fullRange, percent: 1 },
  ];
}

export function getPresetRange(pool: IPool, percent: number): IPoolTickRange {
  return getRangeAroundPrice({
    sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
    percent,
    tickSpacing: pool.tickSpacing ?? 60,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  });
}

/** Plain number for an editable field: 6 significant digits, no grouping */
function toEditable(value: BigNumber) {
  return new BigNumber(value.toPrecision(6)).toFixed();
}

function PriceBoundField({
  label,
  value,
  shown,
  disabled,
  onCommit,
  onStep,
  testID,
}: {
  label: string;
  value: string;
  /** Formatted value, also used for 0 and ∞ */
  shown: string;
  disabled?: boolean;
  onCommit: (text: string) => void;
  onStep: (direction: 'up' | 'down') => void;
  testID: string;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) {
      setText(value);
    }
  }, [focused, value]);

  return (
    <YStack flex={1} gap="$2" p="$3" borderRadius="$3" bg="$bgStrong">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <XStack ai="center" gap="$1">
        {disabled ? (
          <SizableText flex={1} size="$headingMd" numberOfLines={1}>
            {shown}
          </SizableText>
        ) : (
          <Input
            testID={testID}
            flex={1}
            size="small"
            value={focused ? text : shown}
            keyboardType="decimal-pad"
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: '$transparent',
            }}
            onFocus={() => {
              setText(value);
              setFocused(true);
            }}
            onChangeText={setText}
            onBlur={() => {
              setFocused(false);
              onCommit(text);
            }}
          />
        )}
        {disabled ? null : (
          <>
            <IconButton
              testID={`${testID}-minus`}
              size="small"
              variant="tertiary"
              icon="MinusLargeOutline"
              onPress={() => onStep('down')}
            />
            <IconButton
              testID={`${testID}-plus`}
              size="small"
              variant="tertiary"
              icon="PlusLargeOutline"
              onPress={() => onStep('up')}
            />
          </>
        )}
      </XStack>
    </YStack>
  );
}

/**
 * Range step of the add form (doc §2.5 ②): presets, the liquidity chart
 * with the range drawn on it, and min / max that snap to usable ticks and
 * show the snapped price.
 */
export function PoolRangeEditor({
  pool,
  ticks,
  range,
  presetId,
  onChange,
  readOnly = false,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  range: IPoolTickRange;
  presetId?: string;
  onChange: (range: IPoolTickRange, presetId?: string) => void;
  readOnly?: boolean;
}) {
  const [error, setError] = useState<string>();
  const tickSpacing = pool.tickSpacing ?? 60;
  const { inverted } = getPoolPair(pool);
  const decimals = {
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
  const display = getDisplayRange({
    ...range,
    tickSpacing,
    ...decimals,
    inverted,
  });

  const commit = (bound: IRangeDisplayBound, text: string) => {
    const typed = new BigNumber(text.replace(/,/g, ''));
    if (!typed.isFinite() || typed.lte(0)) {
      return;
    }
    const tick = displayPriceToTick({
      displayPrice: typed,
      inverted,
      tickSpacing,
      ...decimals,
    });
    const side = getRangeSideForDisplayBound(bound, inverted);
    const next = { ...range, [side]: tick };
    if (next.tickLower >= next.tickUpper) {
      setError(POOLS_COPY.rangeInverted);
      return;
    }
    setError(undefined);
    onChange(next);
  };

  const step = (bound: IRangeDisplayBound, direction: 'up' | 'down') => {
    setError(undefined);
    onChange(
      stepDisplayBound({ range, bound, direction, inverted, tickSpacing }),
    );
  };

  return (
    <YStack gap="$4">
      {readOnly ? null : (
        <XStack gap="$2" flexWrap="wrap">
          {getRangePresets(pool).map((preset) => (
            <PoolsChip
              key={preset.id}
              testID={`earn-pool-range-preset-${preset.id}`}
              label={preset.label}
              active={presetId === preset.id}
              onPress={() => {
                setError(undefined);
                onChange(getPresetRange(pool, preset.percent), preset.id);
              }}
            />
          ))}
        </XStack>
      )}
      <PoolLiquidityChart
        pool={pool}
        ticks={ticks}
        range={range}
        height={120}
      />
      <XStack gap="$3">
        <PriceBoundField
          testID="earn-pool-range-min"
          label={POOLS_COPY.minPrice}
          value={display.isMinZero ? '0' : toEditable(display.min)}
          shown={display.isMinZero ? '0' : formatTokenPrice(display.min)}
          disabled={readOnly || display.isMinZero}
          onCommit={(text) => commit('min', text)}
          onStep={(direction) => step('min', direction)}
        />
        <PriceBoundField
          testID="earn-pool-range-max"
          label={POOLS_COPY.maxPrice}
          value={display.isMaxInfinite ? '∞' : toEditable(display.max)}
          shown={display.isMaxInfinite ? '∞' : formatTokenPrice(display.max)}
          disabled={readOnly || display.isMaxInfinite}
          onCommit={(text) => commit('max', text)}
          onStep={(direction) => step('max', direction)}
        />
      </XStack>
      {error ? (
        <SizableText size="$bodySm" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
      <XStack jc="space-between" ai="center" gap="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {POOLS_COPY.currentPrice}
        </SizableText>
        <SizableText size="$bodyMdMedium" textAlign="right" flexShrink={1}>
          {`${formatTokenPrice(getPoolDisplayPrice(pool))} ${getPriceUnitLabel(pool)}`}
        </SizableText>
      </XStack>
    </YStack>
  );
}
