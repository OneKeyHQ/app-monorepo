import { useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  IconButton,
  Input,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  displayPriceToTick,
  getDisplayRange,
  getRangeSideForDisplayBound,
  isTickInRange,
  stepDisplayBound,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPoolTickRange,
  IPoolsAprEstimate,
  IRangeDisplayBound,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolPricePoint,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatPriceChange,
  formatTokenPrice,
  getPoolDisplayPrice,
  getPoolPair,
} from '../poolsFormat';
import {
  formatExpectedStay,
  formatPresetWidth,
  getDailyVolatility,
  getExpectedDaysInRange,
  getPresetRange,
} from '../poolsRangePresets';

import { PoolAprFigure } from './PoolAprEstimate';
import { PoolLiquidityChart } from './PoolLiquidityChart';

import type {
  IPoolRangePreset,
  IPoolRangePresetId,
} from '../poolsRangePresets';

/** Plain number for an editable field: 6 significant digits, no grouping */
function toEditable(value: BigNumber) {
  return new BigNumber(value.toPrecision(6)).toFixed();
}

/** A bound against today's price: +11.07%, -9.06% */
function PriceBoundField({
  label,
  change,
  value,
  shown,
  invalidText,
  disabled,
  onCommit,
  onStep,
  testID,
}: {
  label: string;
  /** How far the bound sits from today's price */
  change?: string;
  value: string;
  /** Formatted value, also used for 0 and ∞ */
  shown: string;
  /** What was typed and can't be used; it stays in the box, in red */
  invalidText?: string;
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
      <XStack jc="space-between" gap="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          {label}
        </SizableText>
        {change ? (
          <SizableText
            testID={`${testID}-change`}
            size="$bodySm"
            color="$textSubdued"
          >
            {change}
          </SizableText>
        ) : null}
      </XStack>
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
            value={focused ? text : (invalidText ?? shown)}
            color={invalidText && !focused ? '$textCritical' : undefined}
            keyboardType="decimal-pad"
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: '$transparent',
            }}
            onFocus={() => {
              setText(invalidText ?? value);
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
 * What the chosen range comes to: the estimate, and how long the price is
 * expected to stay inside at the pair's daily moves. A range away from the
 * price says so even without history.
 */
export function PoolRangeFigures({
  pool,
  estimate,
  range,
  priceHistory,
}: {
  pool: IPool;
  estimate: IPoolsAprEstimate | undefined;
  range: IPoolTickRange;
  /** Daily closes of the last 30 days */
  priceHistory: IPoolPricePoint[];
}) {
  const volatility = useMemo(
    () => getDailyVolatility(priceHistory),
    [priceHistory],
  );
  const inRange = isTickInRange({ ...range, tick: pool.currentTick ?? 0 });
  let stay: string | undefined;
  if (!inRange) {
    stay = POOLS_COPY.outOfRange;
  } else if (volatility !== undefined) {
    stay = formatExpectedStay(getExpectedDaysInRange(pool, range, volatility));
  }
  return (
    <XStack jc="space-between" ai="flex-start" gap="$4">
      <PoolAprFigure estimate={estimate} pool={pool} />
      {stay ? (
        <YStack gap="$0.5" ai="flex-end" flexShrink={1}>
          <SizableText size="$bodySm" color="$textSubdued">
            {POOLS_COPY.expectedInRange}
          </SizableText>
          <SizableText
            testID="earn-pool-range-expected-stay"
            size="$headingXl"
            color={inRange ? '$text' : '$textCaution'}
          >
            {stay}
          </SizableText>
        </YStack>
      ) : null}
    </XStack>
  );
}

/** Each preset as a card with its width; the chosen one stands out */
function PoolRangePresetCards({
  presets,
  presetId,
  onSelect,
}: {
  presets: IPoolRangePreset[];
  presetId?: IPoolRangePresetId;
  onSelect: (preset: IPoolRangePreset) => void;
}) {
  return (
    <XStack gap="$2">
      {presets.map((preset) => {
        const active = presetId === preset.id;
        return (
          <YStack
            key={preset.id}
            testID={`earn-pool-range-preset-${preset.id}`}
            flex={1}
            flexBasis={0}
            minWidth={0}
            ai="center"
            gap="$0.5"
            py="$2"
            borderRadius="$3"
            borderWidth={1}
            borderColor={active ? '$borderActive' : '$transparent'}
            bg={active ? '$bg' : '$bgStrong'}
            hoverStyle={{ bg: active ? '$bg' : '$bgHover' }}
            pressStyle={{ bg: active ? '$bg' : '$bgActive' }}
            cursor="pointer"
            userSelect="none"
            onPress={() => onSelect(preset)}
          >
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {preset.name}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {formatPresetWidth(preset)}
            </SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}

/** What a range is, and how the presets are sized */
function PoolRangeInfo() {
  return (
    <Popover
      placement="bottom-start"
      title={POOLS_COPY.priceRange}
      renderTrigger={
        <IconButton
          testID="earn-pool-range-info"
          variant="tertiary"
          size="small"
          icon="InfoCircleOutline"
        />
      }
      renderContent={
        <SizableText px="$pagePadding" py="$4">
          {POOLS_COPY.rangeInfo}
        </SizableText>
      }
    />
  );
}

/**
 * Range step of the add form (doc §2.5 ②), in the order the choice is
 * made: a preset sized to how far the pair moves, the liquidity chart to
 * adjust it by its edges or move it whole, then min / max that snap to
 * usable ticks, each with its distance from today's price. In the create
 * card the figures wait with the other results; under the pool's price
 * chart, where the band is dragged instead, there is no chart of its own
 * and the figures sit under the presets.
 */
export function PoolRangeEditor({
  pool,
  ticks,
  priceHistory,
  estimate,
  range,
  presets,
  presetId,
  onChange,
  readOnly = false,
  underPriceChart = false,
  flipped = false,
  onInvalidChange,
}: {
  pool: IPool;
  /** For the editor's own liquidity chart */
  ticks?: IPoolTickLiquidityNet[];
  /** Daily closes of the last 30 days */
  priceHistory: IPoolPricePoint[];
  estimate: IPoolsAprEstimate | undefined;
  range: IPoolTickRange;
  presets: IPoolRangePreset[];
  presetId?: IPoolRangePresetId;
  onChange: (range: IPoolTickRange, presetId?: IPoolRangePresetId) => void;
  readOnly?: boolean;
  underPriceChart?: boolean;
  /** Prices the other way round, as the chart above shows them */
  flipped?: boolean;
  /** A typed bound is waiting to be corrected, so the form holds its button */
  onInvalidChange?: (invalid: boolean) => void;
}) {
  // A typed Min above Max (or Max below Min) can't become the range. It
  // stays in its box with the reason under it until it is corrected or the
  // range changes another way, so the message never contradicts the boxes.
  const [invalid, setInvalid] = useState<{
    bound: IRangeDisplayBound;
    text: string;
  }>();
  useEffect(() => {
    setInvalid(undefined);
  }, [range.tickLower, range.tickUpper]);
  const hasInvalid = Boolean(invalid);
  useEffect(() => {
    onInvalidChange?.(hasInvalid);
  }, [hasInvalid, onInvalidChange]);
  useEffect(() => () => onInvalidChange?.(false), [onInvalidChange]);
  const tickSpacing = pool.tickSpacing ?? 60;
  const pair = getPoolPair(pool);
  const inverted = flipped ? !pair.inverted : pair.inverted;
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
  const now = getPoolDisplayPrice(pool, flipped);

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
      setInvalid({ bound, text });
      return;
    }
    setInvalid(undefined);
    onChange(next);
  };

  const step = (bound: IRangeDisplayBound, direction: 'up' | 'down') => {
    setInvalid(undefined);
    onChange(
      stepDisplayBound({ range, bound, direction, inverted, tickSpacing }),
    );
  };

  const header = (
    <XStack ai="center" gap="$1">
      <SizableText size={underPriceChart ? '$headingMd' : '$headingSm'}>
        {POOLS_COPY.priceRange}
      </SizableText>
      <PoolRangeInfo />
    </XStack>
  );

  const presetCards = readOnly ? null : (
    <PoolRangePresetCards
      presets={presets}
      presetId={presetId}
      onSelect={(preset) => {
        setInvalid(undefined);
        onChange(getPresetRange(pool, preset.percent), preset.id);
      }}
    />
  );

  // Min / max with their distance from today's price, and a typing error
  const bounds = (
    <>
      <XStack gap="$3">
        <PriceBoundField
          testID="earn-pool-range-min"
          label={POOLS_COPY.minPrice}
          change={
            display.isMinZero ? undefined : formatPriceChange(display.min, now)
          }
          value={display.isMinZero ? '0' : toEditable(display.min)}
          shown={display.isMinZero ? '0' : formatTokenPrice(display.min)}
          invalidText={invalid?.bound === 'min' ? invalid.text : undefined}
          disabled={readOnly || display.isMinZero}
          onCommit={(text) => commit('min', text)}
          onStep={(direction) => step('min', direction)}
        />
        <PriceBoundField
          testID="earn-pool-range-max"
          label={POOLS_COPY.maxPrice}
          change={
            display.isMaxInfinite
              ? undefined
              : formatPriceChange(display.max, now)
          }
          value={display.isMaxInfinite ? '∞' : toEditable(display.max)}
          shown={display.isMaxInfinite ? '∞' : formatTokenPrice(display.max)}
          invalidText={invalid?.bound === 'max' ? invalid.text : undefined}
          disabled={readOnly || display.isMaxInfinite}
          onCommit={(text) => commit('max', text)}
          onStep={(direction) => step('max', direction)}
        />
      </XStack>
      {invalid ? (
        <SizableText
          testID="earn-pool-range-error"
          size="$bodySm"
          color="$textCritical"
        >
          {POOLS_COPY.rangeInverted}
        </SizableText>
      ) : null}
    </>
  );

  if (underPriceChart) {
    return (
      <YStack gap="$4">
        {header}
        {presetCards}
        <PoolRangeFigures
          pool={pool}
          estimate={estimate}
          range={range}
          priceHistory={priceHistory}
        />
        {bounds}
      </YStack>
    );
  }

  return (
    <YStack gap="$3">
      {header}
      {presetCards}
      {ticks ? (
        <PoolLiquidityChart
          pool={pool}
          ticks={ticks}
          range={range}
          onRangeChange={
            readOnly
              ? undefined
              : (next) => {
                  setInvalid(undefined);
                  onChange(next);
                }
          }
          height={96}
        />
      ) : null}
      {bounds}
    </YStack>
  );
}
