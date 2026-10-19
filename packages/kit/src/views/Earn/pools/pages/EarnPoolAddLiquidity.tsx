import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useDebounce } from 'use-debounce';

import {
  ActionList,
  Button,
  Page,
  SegmentControl,
  SizableText,
  Skeleton,
  Switch,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IPool,
  IPoolAddLiquidityParams,
  IPoolAsset,
  IPoolPricePoint,
  IPoolZapInPlan,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { PoolAprEstimate } from '../components/PoolAprEstimate';
import { PoolPairIcon } from '../components/PoolPairIcon';
import {
  PoolRangeEditor,
  getPresetRange,
  getRangePresets,
} from '../components/PoolRangeEditor';
import { PoolsChip } from '../components/PoolsFilterButton';
import { PoolTags } from '../components/PoolTags';
import { PoolUnfinishedTasks } from '../components/PoolUnfinishedTasks';
import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenAmount,
  formatUsd,
  getPoolPair,
  getPoolPairTitle,
} from '../poolsFormat';
import { getVersusHolding } from '../poolsOutcome';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import { PoolsCard } from './EarnPoolDetails';

import type { RouteProp } from '@react-navigation/core';

type IAddMode = 'zap' | 'both';

// Remove's quick picks, so the two forms behave alike
const PERCENT_CHIPS = [0.25, 0.5, 0.75, 1];
// What the earnings and the move against holding are stated on before an
// amount is typed
const REFERENCE_DEPOSIT_USD = 1000;

function toInputAmount(value: BigNumber.Value, decimals: number) {
  const amount = new BigNumber(value);
  if (!amount.isFinite() || amount.lte(0)) {
    return '';
  }
  return amount
    .decimalPlaces(Math.min(decimals, 8), BigNumber.ROUND_DOWN)
    .toFixed();
}

function usdOf(asset: IPoolAsset, amount: BigNumber.Value) {
  const value = new BigNumber(amount);
  return value.isFinite() ? value.times(asset.priceUsd) : new BigNumber(0);
}

function PlanRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <XStack jc="space-between" ai="flex-start" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <YStack ai="flex-end" gap="$0.5" flexShrink={1}>
        {children}
      </YStack>
    </XStack>
  );
}

function ZapPlanView({
  plan,
  pool,
  input,
}: {
  plan: IPoolZapInPlan;
  pool: IPool;
  input: IPoolAsset;
}) {
  const tokens = [pool.token0, pool.token1];
  const swaps = plan.legs.filter((leg) => leg.quote);
  const leftovers = [
    { token: pool.token0, amount: plan.leftover0 },
    { token: pool.token1, amount: plan.leftover1 },
  ].filter(({ token, amount }) => usdOf(token, amount).gte(0.01));
  return (
    <YStack gap="$3">
      {swaps.length ? (
        <PlanRow label={POOLS_COPY.zapPlan}>
          {swaps.map((leg) => (
            <SizableText key={leg.side} size="$bodyMdMedium" textAlign="right">
              {`${formatTokenAmount(leg.amountIn, input.symbol)} → ${formatTokenAmount(
                leg.quote?.amountOut,
                tokens[leg.side].symbol,
              )}`}
            </SizableText>
          ))}
        </PlanRow>
      ) : null}
      {swaps.length ? (
        <PlanRow label={POOLS_COPY.swapCost}>
          <SizableText size="$bodyMdMedium">
            {formatUsd(plan.costUsd)}
          </SizableText>
        </PlanRow>
      ) : null}
      <PlanRow label={POOLS_COPY.goesIn}>
        {[
          { token: pool.token0, amount: plan.used0 },
          { token: pool.token1, amount: plan.used1 },
        ]
          .filter(({ amount }) => new BigNumber(amount).gt(0))
          .map(({ token, amount }) => (
            <SizableText key={token.id} size="$bodyMdMedium">
              {formatTokenAmount(amount, token.symbol)}
            </SizableText>
          ))}
      </PlanRow>
      {leftovers.length ? (
        <PlanRow label={POOLS_COPY.leftover}>
          {leftovers.map(({ token, amount }) => (
            <SizableText key={token.id} size="$bodyMdMedium">
              {formatTokenAmount(amount, token.symbol)}
            </SizableText>
          ))}
        </PlanRow>
      ) : null}
    </YStack>
  );
}

function AddLiquiditySkeleton() {
  return (
    <YStack px="$pagePadding" gap="$5" py="$4">
      <Skeleton w="$48" h="$8" />
      <Skeleton w="100%" h={260} borderRadius="$4" />
      <Skeleton w="100%" h={180} borderRadius="$4" />
    </YStack>
  );
}

function AddLiquidityForm({
  pool,
  ticks,
  priceHistory,
  wallet,
  positionId,
  initialRange,
  onRefreshWallet,
}: {
  pool: IPool;
  ticks: Parameters<typeof PoolRangeEditor>[0]['ticks'];
  priceHistory: IPoolPricePoint[];
  wallet: IPoolsWallet;
  positionId?: string;
  initialRange?: IPoolTickRange;
  onRefreshWallet: () => void;
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const isRange = pool.capabilities.priceRange;
  const tokens = useMemo(
    () => [pool.token0, pool.token1] as const,
    [pool.token0, pool.token1],
  );
  const { inverted } = getPoolPair(pool);

  // Range (doc §2.5 ②)
  const defaultPreset = getRangePresets(pool)[0];
  const [range, setRange] = useState<IPoolTickRange>(
    () =>
      initialRange ??
      (isRange
        ? getPresetRange(pool, defaultPreset.percent)
        : { tickLower: 0, tickUpper: 0 }),
  );
  const [presetId, setPresetId] = useState<string | undefined>(
    initialRange ? undefined : defaultPreset.id,
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
  const shape = isRange ? getRangeDepositShape(rangeContext) : 'both';
  const inRange = isRange
    ? isTickInRange({ ...range, tick: pool.currentTick ?? 0 })
    : true;

  // Mode (doc §2.5 ①). One token first: most people hold one side only.
  const [mode, setMode] = useState<IAddMode>('zap');

  const balanceOf = useCallback(
    (asset: IPoolAsset) => new BigNumber(wallet.balances[asset.id] ?? 0),
    [wallet.balances],
  );
  const nativeAsset = wallet.assets.find((asset) => asset.isNative);
  const wrapSide = ([0, 1] as const).find(
    (side) =>
      pool.capabilities.nativeToken === 'WRAP' &&
      tokens[side].canonicalId.endsWith(':ETH') &&
      !tokens[side].isNative,
  );
  const [payWithNative, setPayWithNative] = useState(() =>
    wrapSide !== undefined && nativeAsset
      ? balanceOf(nativeAsset).gt(balanceOf(tokens[wrapSide]))
      : false,
  );
  const payAssetFor = (side: 0 | 1) =>
    side === wrapSide && payWithNative && nativeAsset
      ? nativeAsset
      : tokens[side];

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
        used0: fit.used0,
        used1: fit.used1,
        valueUsd: getAmountsValueUsd({
          amount0: fit.used0,
          amount1: fit.used1,
          price0Usd: pool.token0.priceUsd,
          price1Usd: pool.token1.priceUsd,
        }),
        shareOfPool: undefined,
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
      used0: mint.used0,
      used1: mint.used1,
      valueUsd: getAmountsValueUsd({
        amount0: mint.used0,
        amount1: mint.used1,
        price0Usd: pool.token0.priceUsd,
        price1Usd: pool.token1.priceUsd,
      }),
      shareOfPool: mint.shareOfPool,
    };
  }, [amounts, isRange, pool, rangeContext]);

  // One token: the Zap plan comes from the background quotes (doc §3.6)
  const zapInputs = useMemo(
    () =>
      wallet.assets
        .filter(
          (asset) =>
            balanceOf(asset).gt(0) || tokens.some((t) => t.id === asset.id),
        )
        .sort(
          (a, b) =>
            usdOf(b, balanceOf(b)).toNumber() -
            usdOf(a, balanceOf(a)).toNumber(),
        ),
    [balanceOf, tokens, wallet.assets],
  );
  // A pool token the user holds needs the fewest swaps; else their largest holding
  const [inputAssetId, setInputAssetId] = useState<string>(() => {
    const held = zapInputs.filter((asset) => balanceOf(asset).gt(0));
    const heldPoolToken = held.find((asset) =>
      tokens.some((token) => token.canonicalId === asset.canonicalId),
    );
    return (heldPoolToken ?? held[0] ?? tokens[1]).id;
  });
  const inputAsset =
    wallet.assets.find((asset) => asset.id === inputAssetId) ?? tokens[1];
  const [amountIn, setAmountIn] = useState('');
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

  const depositUsd = useMemo(
    () =>
      mode === 'zap'
        ? new BigNumber(zapPlan?.depositUsd ?? 0)
        : bothDeposit.valueUsd,
    [bothDeposit.valueUsd, mode, zapPlan?.depositUsd],
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
        ? BigInt(zapPlan?.liquidity ?? '0')
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
    zapPlan?.liquidity,
  ]);

  // The estimate and the move against holding, in money (doc §3.5)
  const hasDeposit = depositUsd.gt(0);
  const statedUsd = hasDeposit
    ? depositUsd
    : new BigNumber(REFERENCE_DEPOSIT_USD);
  const monthlyUsd =
    estimate?.status === 'ok'
      ? statedUsd.times(estimate.apr).div(12)
      : undefined;
  const versus = useMemo(
    () => getVersusHolding(pool, isRange ? range : undefined),
    [isRange, pool, range],
  );
  const versusUsd = statedUsd.times(-versus.fraction);

  // Validation and the button label
  const rangeValid = !isRange || range.tickLower < range.tickUpper;
  const needSide = (side: 0 | 1) =>
    shape === 'both' ||
    (shape === 'token0Only' && side === 0) ||
    (shape === 'token1Only' && side === 1);
  let blocker: string | undefined;
  if (mode === 'zap') {
    const value = new BigNumber(amountIn);
    if (!value.isFinite() || value.lte(0)) {
      blocker = POOLS_COPY.enterAmount;
    } else if (value.gt(balanceOf(inputAsset))) {
      blocker = POOLS_COPY.insufficientBalance(inputAsset.symbol);
    } else if (!zapPlan || isZapLoading || debouncedAmountIn !== amountIn) {
      blocker = POOLS_COPY.review;
    }
  } else {
    const sides = ([0, 1] as const).filter(needSide);
    if (sides.some((side) => !new BigNumber(amounts[side] || 0).gt(0))) {
      blocker = POOLS_COPY.enterAmount;
    } else {
      const short = sides.find((side) =>
        new BigNumber(amounts[side]).gt(balanceOf(payAssetFor(side))),
      );
      if (short !== undefined) {
        blocker = POOLS_COPY.insufficientBalance(payAssetFor(short).symbol);
      }
    }
  }
  const canReview = rangeValid && !blocker;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleReview = async () => {
    const shared = {
      poolId: pool.id,
      positionId,
      ...(isRange ? range : {}),
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
      onRefreshWallet();
      // The task page is the review; going back from it leaves the flow
      navigation.replace(ETabEarnRoutes.EarnPoolTask, { taskId: task.id });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInputPicker = () => {
    ActionList.show({
      title: POOLS_COPY.oneToken,
      items: zapInputs.map((asset) => ({
        label: asset.symbol,
        extra: (
          <SizableText size="$bodyMd" color="$textSubdued">
            {formatTokenAmount(balanceOf(asset))}
          </SizableText>
        ),
        onPress: () => {
          setInputAssetId(asset.id);
          setAmountIn('');
        },
      })),
    });
  };

  const rangeCard = isRange ? (
    <PoolsCard title={POOLS_COPY.presets}>
      <PoolRangeEditor
        pool={pool}
        ticks={ticks}
        priceHistory={priceHistory}
        estimate={estimate}
        range={range}
        presetId={presetId}
        readOnly={Boolean(positionId)}
        onChange={(next, nextPresetId) => {
          setRange(next);
          setPresetId(nextPresetId);
        }}
      />
    </PoolsCard>
  ) : null;

  const sideInput = (side: 0 | 1) => {
    const asset = payAssetFor(side);
    const value = amounts[side];
    return (
      <YStack key={side} gap="$2">
        <AmountInput
          value={value}
          onChange={(text) => {
            if (!validateAmountInputForStaking(text, asset.decimals)) {
              return;
            }
            setLastSide(side);
            setAmounts(quoteOther(side, text));
          }}
          hasError={new BigNumber(value || 0).gt(balanceOf(asset))}
          tokenSelectorTriggerProps={{
            selectedTokenImageUri: asset.logoURI,
            selectedTokenSymbol: asset.symbol,
            disabled: true,
          }}
          balanceProps={{
            value: balanceOf(asset).toFixed(),
            onPress: () => {
              setLastSide(side);
              setAmounts(
                quoteOther(
                  side,
                  toInputAmount(balanceOf(asset), asset.decimals),
                ),
              );
            },
          }}
          valueProps={{
            value: usdOf(asset, value || 0).toFixed(2),
            currency: '$',
          }}
          inputProps={{
            placeholder: '0',
            testID: `earn-pool-add-amount-${side}`,
          }}
          enableMaxAmount
        />
        {side === wrapSide && nativeAsset ? (
          <XStack ai="center" jc="space-between">
            <SizableText size="$bodyMd" color="$textSubdued">
              {POOLS_COPY.payWithEth}
            </SizableText>
            <Switch
              testID="earn-pool-add-pay-with-eth"
              size="small"
              value={payWithNative}
              onChange={(checked) => setPayWithNative(Boolean(checked))}
            />
          </XStack>
        ) : null}
      </YStack>
    );
  };

  const onlySide = shape === 'token0Only' ? 0 : 1;
  const depositCard = (
    <PoolsCard title={POOLS_COPY.deposit}>
      <SegmentControl
        fullWidth
        value={mode}
        options={[
          {
            label: POOLS_COPY.oneToken,
            value: 'zap',
            testID: 'earn-pool-mode-zap',
          },
          {
            label: POOLS_COPY.bothTokens,
            value: 'both',
            testID: 'earn-pool-mode-both',
          },
        ]}
        onChange={(value) => setMode(value as IAddMode)}
      />
      {mode === 'zap' ? (
        <YStack gap="$3">
          <AmountInput
            value={amountIn}
            onChange={(text) => {
              if (validateAmountInputForStaking(text, inputAsset.decimals)) {
                setAmountIn(text);
              }
            }}
            hasError={new BigNumber(amountIn || 0).gt(balanceOf(inputAsset))}
            tokenSelectorTriggerProps={{
              selectedTokenImageUri: inputAsset.logoURI,
              selectedTokenSymbol: inputAsset.symbol,
              onPress: openInputPicker,
            }}
            balanceProps={{
              value: balanceOf(inputAsset).toFixed(),
              onPress: () =>
                setAmountIn(
                  toInputAmount(balanceOf(inputAsset), inputAsset.decimals),
                ),
            }}
            valueProps={{
              value: usdOf(inputAsset, amountIn || 0).toFixed(2),
              currency: '$',
            }}
            inputProps={{
              placeholder: '0',
              testID: 'earn-pool-add-amount-zap',
            }}
            enableMaxAmount
          />
          <XStack gap="$2" flexWrap="wrap">
            {PERCENT_CHIPS.map((percent) => {
              const value = toInputAmount(
                balanceOf(inputAsset).times(percent),
                inputAsset.decimals,
              );
              return (
                <PoolsChip
                  key={percent}
                  testID={`earn-pool-add-percent-${percent * 100}`}
                  label={
                    percent === 1 ? POOLS_COPY.maxAmount : `${percent * 100}%`
                  }
                  active={Boolean(value) && amountIn === value}
                  onPress={() => setAmountIn(value)}
                />
              );
            })}
          </XStack>
        </YStack>
      ) : (
        <YStack gap="$3">
          {shape === 'both' ? (
            (inverted ? ([1, 0] as const) : ([0, 1] as const)).map(sideInput)
          ) : (
            <>
              <SizableText size="$bodyMd" color="$textSubdued">
                {POOLS_COPY.onlyToken(tokens[onlySide].symbol)}
              </SizableText>
              {sideInput(onlySide)}
            </>
          )}
        </YStack>
      )}
    </PoolsCard>
  );

  const previewCard = (
    <PoolsCard>
      {/* Range pools show the estimate beside the presets */}
      {isRange ? null : <PoolAprEstimate estimate={estimate} pool={pool} />}
      {monthlyUsd ? (
        <PlanRow label={POOLS_COPY.estimatedEarnings}>
          <SizableText size="$bodyMdMedium" color="$textSuccess">
            {POOLS_COPY.perMonth(formatUsd(monthlyUsd))}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
            {hasDeposit
              ? POOLS_COPY.atTodaysFees
              : POOLS_COPY.onReferenceDeposit(formatUsd(REFERENCE_DEPOSIT_USD))}
          </SizableText>
        </PlanRow>
      ) : null}
      {versus.fraction < -0.0005 ? (
        <PlanRow
          label={POOLS_COPY.versusHoldingLabel(
            getPoolPair(pool).base.symbol,
            `${versus.move * 100}%`,
          )}
        >
          <SizableText size="$bodyMdMedium" textAlign="right">
            {POOLS_COPY.lessThanHolding(formatUsd(versusUsd))}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {POOLS_COPY.beforeFees}
          </SizableText>
        </PlanRow>
      ) : null}
      {mode === 'zap' && zapPlan ? (
        <ZapPlanView plan={zapPlan} pool={pool} input={inputAsset} />
      ) : null}
      {mode === 'both' && bothDeposit.valueUsd.gt(0) ? (
        <YStack gap="$3">
          <PlanRow label={POOLS_COPY.goesIn}>
            <SizableText size="$bodyMdMedium">
              {formatUsd(bothDeposit.valueUsd)}
            </SizableText>
          </PlanRow>
          {bothDeposit.shareOfPool ? (
            <PlanRow label={POOLS_COPY.shareOfPool}>
              <SizableText size="$bodyMdMedium">
                {`${bothDeposit.shareOfPool.times(100).toFixed(4)}%`}
              </SizableText>
            </PlanRow>
          ) : null}
        </YStack>
      ) : null}
    </PoolsCard>
  );

  const buttonLabel = !rangeValid
    ? POOLS_COPY.rangeInverted
    : (blocker ?? POOLS_COPY.review);

  const footer = gtMd ? null : (
    <Page.Footer
      onConfirmText={buttonLabel}
      confirmButtonProps={{
        variant: 'primary',
        disabled: !canReview,
        loading: isSubmitting || (mode === 'zap' && isZapLoading),
        onPress: () => void handleReview(),
        mb: tabBarHeight,
        testID: 'earn-pool-add-review',
      }}
    />
  );

  const breadcrumbProps = usePoolsBreadcrumb([
    {
      label: getPoolPairTitle(pool),
      onClick: () =>
        navigation.navigate(ETabEarnRoutes.EarnPoolDetails, {
          poolId: pool.id,
        }),
    },
    { label: positionId ? POOLS_COPY.stepIncrease : POOLS_COPY.addLiquidity },
  ]);

  const header = (
    <XStack ai="center" gap="$3">
      <PoolPairIcon pool={pool} size="md" />
      <YStack gap="$1" flex={1}>
        <SizableText size="$headingLg">{getPoolPairTitle(pool)}</SizableText>
        <PoolTags pool={pool} />
      </YStack>
    </XStack>
  );

  return (
    <EarnPageContainer
      pageTitle={
        <SizableText size="$headingLg">
          {positionId ? POOLS_COPY.add : POOLS_COPY.addLiquidity}
        </SizableText>
      }
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <YStack px="$pagePadding" gap="$5" pt={gtMd ? '$0' : '$4'}>
        {header}
        <PoolUnfinishedTasks poolId={pool.id} />
        {gtMd && rangeCard ? (
          <XStack gap="$6" ai="flex-start">
            <YStack flex={55} flexBasis={0} minWidth={0}>
              {rangeCard}
            </YStack>
            <YStack flex={45} flexBasis={0} minWidth={0} gap="$5">
              {depositCard}
              {previewCard}
              <Button
                variant="primary"
                size="large"
                disabled={!canReview}
                loading={isSubmitting}
                onPress={() => void handleReview()}
                testID="earn-pool-add-review"
              >
                {buttonLabel}
              </Button>
            </YStack>
          </XStack>
        ) : (
          <YStack gap="$5" maxWidth={gtMd ? 560 : undefined}>
            {rangeCard}
            {depositCard}
            {previewCard}
            {gtMd ? (
              <Button
                variant="primary"
                size="large"
                disabled={!canReview}
                loading={isSubmitting}
                onPress={() => void handleReview()}
                testID="earn-pool-add-review"
              >
                {buttonLabel}
              </Button>
            ) : null}
          </YStack>
        )}
      </YStack>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnPoolAddLiquidity
>;

function EarnPoolAddLiquidityContent({
  poolId,
  positionId,
}: {
  poolId: string;
  positionId?: string;
}) {
  const { result: detail } = usePromiseResult(
    () => backgroundApiProxy.servicePools.getPoolDetail({ poolId }),
    [poolId],
  );
  const networkId = detail?.pool.networkId;
  const { result: wallet, run: refreshWallet } = usePromiseResult(
    () =>
      networkId
        ? backgroundApiProxy.servicePools.getWallet({ networkId })
        : Promise.resolve(undefined),
    [networkId],
    { revalidateOnFocus: true },
  );
  const { result: portfolio } = usePromiseResult(
    () =>
      positionId
        ? backgroundApiProxy.servicePools.getPortfolio()
        : Promise.resolve(undefined),
    [positionId],
  );
  const position = portfolio?.positions.find(
    (view) => view.position.id === positionId,
  )?.position;

  if (!detail || !wallet || (positionId && !position)) {
    return (
      <EarnPageContainer
        pageTitle={
          <SizableText size="$headingLg">{POOLS_COPY.addLiquidity}</SizableText>
        }
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        <AddLiquiditySkeleton />
      </EarnPageContainer>
    );
  }

  return (
    <AddLiquidityForm
      pool={detail.pool}
      ticks={detail.ticks}
      priceHistory={detail.priceHistory}
      wallet={wallet}
      positionId={positionId}
      initialRange={
        position?.tickLower !== undefined && position.tickUpper !== undefined
          ? { tickLower: position.tickLower, tickUpper: position.tickUpper }
          : undefined
      }
      onRefreshWallet={() => void refreshWallet()}
    />
  );
}

export default function EarnPoolAddLiquidity() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolAddLiquidityContent
          poolId={route.params.poolId}
          positionId={route.params.positionId}
        />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
