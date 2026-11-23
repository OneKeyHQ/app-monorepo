import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useDebounce } from 'use-debounce';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  REFERENCE_LIQUIDITY,
  estimateRangeApr,
  estimateShareApr,
  fitRangeDeposit,
  getAmountsValueUsd,
  getRangeAmountsPerLiquidity,
  getRangeDepositShape,
  getShareMint,
  isTickInRange,
  quoteRangeDeposit,
  quoteShareDeposit,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPoolTickRange,
  IPoolsAprEstimate,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolAddLiquidityParams,
  IPoolAsset,
  IPoolPricePoint,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from './poolsCopy';
import { getPoolPair, getPoolRisk } from './poolsFormat';
import { getVersusHolding } from './poolsOutcome';
import {
  DEFAULT_RANGE_PRESET_ID,
  getPresetRange,
  getRangePresets,
} from './poolsRangePresets';

import type { IPoolRisk } from './poolsFormat';
import type { IPoolRangePresetId } from './poolsRangePresets';

export type IPoolAddMode = 'zap' | 'both';

export function toInputAmount(value: BigNumber.Value, decimals: number) {
  const amount = new BigNumber(value);
  if (!amount.isFinite() || amount.lte(0)) {
    return '';
  }
  return amount
    .decimalPlaces(Math.min(decimals, 8), BigNumber.ROUND_DOWN)
    .toFixed();
}

export function usdOf(asset: IPoolAsset, amount: BigNumber.Value) {
  const value = new BigNumber(amount);
  return value.isFinite() ? value.times(asset.priceUsd) : new BigNumber(0);
}

/** Resolves true once the user accepts what makes the pool risky */
function confirmPoolRisk(risk: IPoolRisk) {
  const copy = POOLS_COPY.poolRisk[risk];
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'warning',
      title: copy.title,
      description: copy.body,
      onConfirmText: POOLS_COPY.poolRiskConfirm,
      onCancelText: POOLS_COPY.cancel,
      confirmButtonProps: { testID: 'earn-pool-risk-confirm' },
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

/**
 * The create-position form's state and rules (doc §2.5), shared by an opened
 * pool row, the pool page and Add to a position. The range lives here so the
 * chart can draw it and a copied range can replace it. The wallet can arrive
 * after the form opens; until the user picks, defaults follow it.
 */
export function usePoolPositionForm({
  pool,
  wallet,
  priceHistory,
  positionId,
  initialRange,
  onTaskCreated,
}: {
  pool: IPool;
  wallet: IPoolsWallet | undefined;
  /** Daily closes of the last 30 days; sizes the range presets */
  priceHistory?: IPoolPricePoint[];
  /** Adds to this position; its range is fixed */
  positionId?: string;
  initialRange?: IPoolTickRange;
  onTaskCreated: (taskId: string) => void;
}) {
  const isRange = pool.capabilities.priceRange;
  const tokens = useMemo(
    () => [pool.token0, pool.token1] as const,
    [pool.token0, pool.token1],
  );

  // Range (doc §2.5 ②). A chosen preset is a rule rather than ticks: the
  // history that sizes it can arrive after the form opens, and the range
  // follows it
  const presets = useMemo(
    () => (isRange ? getRangePresets(pool, priceHistory) : []),
    [isRange, pool, priceHistory],
  );
  const [choice, setChoice] = useState<{
    range?: IPoolTickRange;
    presetId?: IPoolRangePresetId;
  }>(() => {
    if (initialRange) {
      return { range: initialRange };
    }
    return isRange
      ? { presetId: DEFAULT_RANGE_PRESET_ID }
      : { range: { tickLower: 0, tickUpper: 0 } };
  });
  const presetId = choice.presetId;
  const range = useMemo<IPoolTickRange>(() => {
    const preset = presets.find((item) => item.id === presetId);
    if (preset) {
      return getPresetRange(pool, preset.percent);
    }
    return choice.range ?? { tickLower: 0, tickUpper: 0 };
  }, [choice.range, pool, presetId, presets]);
  const setRange = useCallback(
    (next: IPoolTickRange, nextPresetId?: IPoolRangePresetId) =>
      setChoice(nextPresetId ? { presetId: nextPresetId } : { range: next }),
    [],
  );
  const rangeContext = useMemo(
    () => ({
      sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
      tickLower: range.tickLower,
      tickUpper: range.tickUpper,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
    }),
    [pool, range],
  );
  // Which way prices read: the chart's flip turns the card's range too
  const [flipped, setFlipped] = useState(false);
  const shape = isRange ? getRangeDepositShape(rangeContext) : 'both';
  const inRange = isRange
    ? isTickInRange({ ...range, tick: pool.currentTick ?? 0 })
    : true;

  // Mode (doc §2.5 ①). One token first: most people hold one side only.
  const [mode, setMode] = useState<IPoolAddMode>('zap');

  const balances = wallet?.balances;
  const balanceOf = useCallback(
    (asset: IPoolAsset) => new BigNumber(balances?.[asset.id] ?? 0),
    [balances],
  );
  const nativeAsset = wallet?.assets.find((asset) => asset.isNative);
  // The chain's wrapped coin (WETH, WBNB) can be paid in the coin itself
  const wrapSide = ([0, 1] as const).find(
    (side) =>
      pool.capabilities.nativeToken === 'WRAP' &&
      nativeAsset !== undefined &&
      tokens[side].canonicalId === nativeAsset.canonicalId &&
      !tokens[side].isNative,
  );
  const [payWithNativeChoice, setPayWithNative] = useState<boolean>();
  const payWithNative =
    payWithNativeChoice ??
    (wrapSide !== undefined && nativeAsset
      ? balanceOf(nativeAsset).gt(balanceOf(tokens[wrapSide]))
      : false);
  const payAssetFor = useCallback(
    (side: 0 | 1) =>
      side === wrapSide && payWithNative && nativeAsset
        ? nativeAsset
        : tokens[side],
    [nativeAsset, payWithNative, tokens, wrapSide],
  );

  // Both tokens: typing one side fills the other (doc §3.4)
  const [amounts, setAmounts] = useState<[string, string]>(['', '']);
  const [lastSide, setLastSide] = useState<0 | 1>(0);
  const quoteOther = useCallback(
    (side: 0 | 1, text: string): [string, string] => {
      const other = side === 0 ? 1 : 0;
      const value = new BigNumber(text);
      if (!value.isFinite() || value.lte(0)) {
        return side === 0 ? [text, ''] : ['', text];
      }
      const quoted = isRange
        ? quoteRangeDeposit({ ...rangeContext, side, amount: value })
        : quoteShareDeposit({
            reserve0: pool.reserve0,
            reserve1: pool.reserve1,
            side,
            amount: value,
          });
      const next: [string, string] = ['', ''];
      next[side] = text;
      next[other] = toInputAmount(
        other === 0 ? quoted.amount0 : quoted.amount1,
        tokens[other].decimals,
      );
      return next;
    },
    [isRange, pool.reserve0, pool.reserve1, rangeContext, tokens],
  );
  const setSideAmount = useCallback(
    (side: 0 | 1, text: string) => {
      setLastSide(side);
      setAmounts(quoteOther(side, text));
    },
    [quoteOther],
  );
  // A new range changes the ratio, so re-derive from the side typed last
  useEffect(() => {
    setAmounts((prev) => {
      if (!prev[lastSide]) {
        return prev;
      }
      const next = quoteOther(lastSide, prev[lastSide]);
      return next[0] === prev[0] && next[1] === prev[1] ? prev : next;
    });
  }, [lastSide, quoteOther]);

  const bothDeposit = useMemo(() => {
    const amount0 = new BigNumber(amounts[0] || 0);
    const amount1 = new BigNumber(amounts[1] || 0);
    if (isRange) {
      const fit = fitRangeDeposit({ ...rangeContext, amount0, amount1 });
      return {
        liquidity: fit.liquidity,
        addsLiquidity: fit.liquidity > BigInt(0),
        used0: fit.used0,
        used1: fit.used1,
        valueUsd: getAmountsValueUsd({
          amount0: fit.used0,
          amount1: fit.used1,
          price0Usd: pool.token0.priceUsd,
          price1Usd: pool.token1.priceUsd,
        }),
      };
    }
    const mint = getShareMint({
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      totalSupply: pool.lpTotalSupply ?? 0,
      amount0,
      amount1,
    });
    return {
      liquidity: BigInt(0),
      // LP tokens count to 18 decimals
      addsLiquidity: mint.liquidity
        .decimalPlaces(18, BigNumber.ROUND_FLOOR)
        .gt(0),
      used0: mint.used0,
      used1: mint.used1,
      valueUsd: getAmountsValueUsd({
        amount0: mint.used0,
        amount1: mint.used1,
        price0Usd: pool.token0.priceUsd,
        price1Usd: pool.token1.priceUsd,
      }),
    };
  }, [amounts, isRange, pool, rangeContext]);

  // One token: the Zap plan comes from the background quotes (doc §3.6)
  const walletAssets = wallet?.assets;
  const zapInputs = useMemo(
    () =>
      (walletAssets ?? [])
        .filter(
          (asset) =>
            balanceOf(asset).gt(0) || tokens.some((t) => t.id === asset.id),
        )
        .sort(
          (a, b) =>
            usdOf(b, balanceOf(b)).toNumber() -
            usdOf(a, balanceOf(a)).toNumber(),
        ),
    [balanceOf, tokens, walletAssets],
  );
  // A pool token the user holds needs the fewest swaps; else their largest holding
  const defaultInputAssetId = useMemo(() => {
    const held = zapInputs.filter((asset) => balanceOf(asset).gt(0));
    const heldPoolToken = held.find((asset) =>
      tokens.some((token) => token.canonicalId === asset.canonicalId),
    );
    return (heldPoolToken ?? held[0] ?? tokens[1]).id;
  }, [balanceOf, tokens, zapInputs]);
  const [inputAssetChoice, setInputAssetChoice] = useState<string>();
  const inputAssetId = inputAssetChoice ?? defaultInputAssetId;
  const inputAsset =
    walletAssets?.find((asset) => asset.id === inputAssetId) ?? tokens[1];
  const [amountIn, setAmountIn] = useState('');
  const selectInputAsset = useCallback((assetId: string) => {
    setInputAssetChoice(assetId);
    setAmountIn('');
  }, []);
  const [debouncedAmountIn] = useDebounce(amountIn, 300);
  const { result: zapPlan, isLoading: isZapLoading } = usePromiseResult(
    async () => {
      const value = new BigNumber(debouncedAmountIn);
      if (mode !== 'zap' || !value.isFinite() || value.lte(0)) {
        return undefined;
      }
      return backgroundApiProxy.servicePools.planZapIn({
        poolId: pool.id,
        inputAssetId,
        amountIn: value.toFixed(),
        ...(isRange ? range : {}),
      });
    },
    [debouncedAmountIn, inputAssetId, isRange, mode, pool.id, range],
    { watchLoading: true },
  );
  // A plan for an amount that has since been cleared is not shown
  const shownZapPlan = amountIn ? zapPlan : undefined;

  const depositUsd = useMemo(
    () =>
      mode === 'zap'
        ? new BigNumber(shownZapPlan?.depositUsd ?? 0)
        : bothDeposit.valueUsd,
    [bothDeposit.valueUsd, mode, shownZapPlan?.depositUsd],
  );

  // APR estimate (doc §3.5)
  const estimate = useMemo<IPoolsAprEstimate | undefined>(() => {
    if (!isRange) {
      return estimateShareApr({
        fees24hUsd: pool.fees24hUsd,
        tvlUsd: pool.tvlUsd,
        depositUsd,
      });
    }
    const per = getRangeAmountsPerLiquidity(rangeContext);
    const liquidity =
      mode === 'zap'
        ? BigInt(shownZapPlan?.liquidity ?? '0')
        : bothDeposit.liquidity;
    return estimateRangeApr({
      fees24hUsd: pool.fees24hUsd,
      tvlUsd: pool.tvlUsd,
      activeLiquidity: BigInt(pool.activeLiquidity ?? '0'),
      inRange,
      supported: pool.aprEstimateSupported,
      deposit:
        liquidity > BigInt(0) ? { liquidity, valueUsd: depositUsd } : undefined,
      reference: {
        liquidity: REFERENCE_LIQUIDITY,
        valueUsd: getAmountsValueUsd({
          amount0: per.amount0,
          amount1: per.amount1,
          price0Usd: pool.token0.priceUsd,
          price1Usd: pool.token1.priceUsd,
        }),
      },
    });
  }, [
    bothDeposit.liquidity,
    depositUsd,
    inRange,
    isRange,
    mode,
    pool,
    rangeContext,
    shownZapPlan?.liquidity,
  ]);

  // The estimate and the move against holding in money, once there is an
  // amount (doc §3.5)
  const hasDeposit = depositUsd.gt(0);
  const monthlyUsd =
    hasDeposit && estimate?.status === 'ok'
      ? depositUsd.times(estimate.apr).div(12)
      : undefined;
  const versus = useMemo(
    () => getVersusHolding(pool, isRange ? range : undefined),
    [isRange, pool, range],
  );
  const versusUsd = depositUsd.times(-versus.fraction);

  // Validation and the button label
  const rangeValid = !isRange || range.tickLower < range.tickUpper;
  // A typed Min above Max (or Max below Min) never reaches `range`; the
  // editor keeps it in its box and reports it here, so Review waits
  const [rangeInputInvalid, setRangeInputInvalid] = useState(false);
  const needSide = useCallback(
    (side: 0 | 1) =>
      shape === 'both' ||
      (shape === 'token0Only' && side === 0) ||
      (shape === 'token1Only' && side === 1),
    [shape],
  );
  let blocker: string | undefined;
  if (!wallet) {
    blocker = POOLS_COPY.review;
  } else if (mode === 'zap') {
    const value = new BigNumber(amountIn);
    if (!value.isFinite() || value.lte(0)) {
      blocker = POOLS_COPY.enterAmount;
    } else if (value.gt(balanceOf(inputAsset))) {
      blocker = POOLS_COPY.insufficientBalance([inputAsset.symbol]);
    } else if (!zapPlan || isZapLoading || debouncedAmountIn !== amountIn) {
      blocker = POOLS_COPY.review;
    } else if (!new BigNumber(zapPlan.liquidity).gt(0)) {
      // Else it fails at the last step, after the swaps
      blocker = POOLS_COPY.amountTooSmall;
    }
  } else {
    const sides = ([0, 1] as const).filter(needSide);
    if (sides.some((side) => !new BigNumber(amounts[side] || 0).gt(0))) {
      blocker = POOLS_COPY.enterAmount;
    } else {
      // Every token that falls short, in the order their boxes show
      const shown = getPoolPair(pool).inverted ? sides.toReversed() : sides;
      const short = shown.filter((side) =>
        new BigNumber(amounts[side]).gt(balanceOf(payAssetFor(side))),
      );
      if (short.length) {
        blocker = POOLS_COPY.insufficientBalance(
          short.map((side) => payAssetFor(side).symbol),
        );
      } else if (!bothDeposit.addsLiquidity) {
        blocker = POOLS_COPY.amountTooSmall;
      }
    }
  }
  const canReview = rangeValid && !rangeInputInvalid && !blocker;
  const buttonLabel =
    !rangeValid || rangeInputInvalid
      ? POOLS_COPY.rangeInverted
      : (blocker ?? POOLS_COPY.review);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const review = async () => {
    if (!canReview) {
      return;
    }
    // A pool the list leaves out, or one with a token that has no trusted
    // price, takes liquidity once the user accepts the risk
    const risk = getPoolRisk(pool);
    if (risk && !(await confirmPoolRisk(risk))) {
      return;
    }
    const shared = {
      poolId: pool.id,
      positionId,
      ...(isRange ? range : {}),
      ...(risk ? { riskConfirmed: true } : {}),
    };
    const params: IPoolAddLiquidityParams =
      mode === 'zap'
        ? { ...shared, mode: 'zap', inputAssetId, amountIn }
        : {
            ...shared,
            mode: 'both',
            amount0: needSide(0) ? amounts[0] || '0' : '0',
            amount1: needSide(1) ? amounts[1] || '0' : '0',
            payWithNative,
          };
    setIsSubmitting(true);
    try {
      const task = await backgroundApiProxy.servicePools.createTask({
        kind: 'add',
        params,
      });
      // The form stays open behind the task page; it starts over
      setAmounts(['', '']);
      setAmountIn('');
      onTaskCreated(task.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    pool,
    wallet,
    positionId,
    isRange,
    tokens,
    // Range
    range,
    presets,
    presetId,
    setRange,
    inRange,
    flipped,
    setFlipped,
    shape,
    // Deposit
    mode,
    setMode,
    balanceOf,
    nativeAsset,
    wrapSide,
    payWithNative,
    setPayWithNative,
    payAssetFor,
    amounts,
    setSideAmount,
    zapInputs,
    inputAsset,
    selectInputAsset,
    amountIn,
    setAmountIn,
    zapPlan: shownZapPlan,
    isZapLoading,
    bothDeposit,
    // Outcome
    estimate,
    hasDeposit,
    monthlyUsd,
    versus,
    versusUsd,
    // Submit
    setRangeInputInvalid,
    canReview,
    buttonLabel,
    isSubmitting,
    isBusy: isSubmitting || (mode === 'zap' && isZapLoading),
    review,
  };
}

export type IPoolPositionForm = ReturnType<typeof usePoolPositionForm>;
