import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';

import {
  ActionList,
  Button,
  SegmentControl,
  SizableText,
  Skeleton,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { getDisplayRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolAsset,
  IPoolPricePoint,
  IPoolTickLiquidityNet,
  IPoolZapInPlan,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatTokenAmount,
  formatTokenPrice,
  formatUsd,
  getPoolPair,
  getPriceUnitLabel,
} from '../poolsFormat';
import {
  REFERENCE_DEPOSIT_USD,
  toInputAmount,
  usdOf,
} from '../usePoolPositionForm';

import { PoolAprEstimate } from './PoolAprEstimate';
import { PoolRangeEditor } from './PoolRangeEditor';
import { PoolsCard } from './PoolsCard';
import { PoolsChip } from './PoolsFilterButton';

import type { IPoolAddMode, IPoolPositionForm } from '../usePoolPositionForm';

// Remove's quick picks, so the two forms behave alike
const PERCENT_CHIPS = [0.25, 0.5, 0.75, 1];

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

function SideInput({ form, side }: { form: IPoolPositionForm; side: 0 | 1 }) {
  const asset = form.payAssetFor(side);
  const value = form.amounts[side];
  return (
    <YStack gap="$2">
      <AmountInput
        value={value}
        onChange={(text) => {
          if (validateAmountInputForStaking(text, asset.decimals)) {
            form.setSideAmount(side, text);
          }
        }}
        hasError={new BigNumber(value || 0).gt(form.balanceOf(asset))}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: asset.logoURI,
          selectedTokenSymbol: asset.symbol,
          disabled: true,
        }}
        balanceProps={{
          value: form.balanceOf(asset).toFixed(),
          onPress: () =>
            form.setSideAmount(
              side,
              toInputAmount(form.balanceOf(asset), asset.decimals),
            ),
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
      {side === form.wrapSide && form.nativeAsset ? (
        <XStack ai="center" jc="space-between">
          <SizableText size="$bodyMd" color="$textSubdued">
            {POOLS_COPY.payWithEth}
          </SizableText>
          <Switch
            testID="earn-pool-add-pay-with-eth"
            size="small"
            value={form.payWithNative}
            onChange={(checked) => form.setPayWithNative(Boolean(checked))}
          />
        </XStack>
      ) : null}
    </YStack>
  );
}

function ZapInput({ form }: { form: IPoolPositionForm }) {
  const { inputAsset, amountIn } = form;
  const openInputPicker = () => {
    ActionList.show({
      title: POOLS_COPY.oneToken,
      items: form.zapInputs.map((asset) => ({
        label: asset.symbol,
        extra: (
          <SizableText size="$bodyMd" color="$textSubdued">
            {formatTokenAmount(form.balanceOf(asset))}
          </SizableText>
        ),
        onPress: () => form.selectInputAsset(asset.id),
      })),
    });
  };
  return (
    <YStack gap="$3">
      <AmountInput
        value={amountIn}
        onChange={(text) => {
          if (validateAmountInputForStaking(text, inputAsset.decimals)) {
            form.setAmountIn(text);
          }
        }}
        hasError={new BigNumber(amountIn || 0).gt(form.balanceOf(inputAsset))}
        tokenSelectorTriggerProps={{
          selectedTokenImageUri: inputAsset.logoURI,
          selectedTokenSymbol: inputAsset.symbol,
          onPress: openInputPicker,
        }}
        balanceProps={{
          value: form.balanceOf(inputAsset).toFixed(),
          onPress: () =>
            form.setAmountIn(
              toInputAmount(form.balanceOf(inputAsset), inputAsset.decimals),
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
            form.balanceOf(inputAsset).times(percent),
            inputAsset.decimals,
          );
          return (
            <PoolsChip
              key={percent}
              testID={`earn-pool-add-percent-${percent * 100}`}
              label={percent === 1 ? POOLS_COPY.maxAmount : `${percent * 100}%`}
              active={Boolean(value) && amountIn === value}
              onPress={() => form.setAmountIn(value)}
            />
          );
        })}
      </XStack>
    </YStack>
  );
}

/** One token or both, and the amounts */
function DepositFields({ form }: { form: IPoolPositionForm }) {
  const { inverted } = getPoolPair(form.pool);
  const onlySide = form.shape === 'token0Only' ? 0 : 1;
  let inputs: ReactNode;
  if (!form.wallet) {
    inputs = (
      <YStack gap="$3">
        <Skeleton w="100%" h={104} borderRadius="$3" />
        <Skeleton w="$48" h="$7" borderRadius="$full" />
      </YStack>
    );
  } else if (form.mode === 'zap') {
    inputs = <ZapInput form={form} />;
  } else if (form.shape === 'both') {
    inputs = (
      <YStack gap="$3">
        {(inverted ? ([1, 0] as const) : ([0, 1] as const)).map((side) => (
          <SideInput key={side} form={form} side={side} />
        ))}
      </YStack>
    );
  } else {
    inputs = (
      <YStack gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {POOLS_COPY.onlyToken(form.tokens[onlySide].symbol)}
        </SizableText>
        <SideInput form={form} side={onlySide} />
      </YStack>
    );
  }
  return (
    <>
      <SegmentControl
        fullWidth
        value={form.mode}
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
        onChange={(value) => form.setMode(value as IPoolAddMode)}
      />
      {inputs}
    </>
  );
}

/**
 * The range set on the chart, so the card shows everything the position
 * takes, also with the chart scrolled away or after a copied range.
 */
function RangeSummaryRow({ form }: { form: IPoolPositionForm }) {
  const { pool, range } = form;
  const display = getDisplayRange({
    ...range,
    tickSpacing: pool.tickSpacing ?? 60,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
    inverted: getPoolPair(pool).inverted,
  });
  const isFull = display.isMinZero && display.isMaxInfinite;
  const min = display.isMinZero ? '0' : formatTokenPrice(display.min);
  const max = display.isMaxInfinite ? '∞' : formatTokenPrice(display.max);
  return (
    <PlanRow label={POOLS_COPY.priceRange}>
      <SizableText
        testID="earn-pool-create-range"
        size="$bodyMdMedium"
        textAlign="right"
      >
        {isFull ? POOLS_COPY.fullRange : `${min} – ${max}`}
      </SizableText>
      {isFull ? null : (
        <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
          {getPriceUnitLabel(pool)}
        </SizableText>
      )}
    </PlanRow>
  );
}

/** What the deposit comes to; empty until there is something to show */
function getOutcomeRows(form: IPoolPositionForm) {
  const { pool, versus } = form;
  const rows: ReactNode[] = [];
  if (form.monthlyUsd) {
    rows.push(
      <PlanRow key="earnings" label={POOLS_COPY.estimatedEarnings}>
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          {POOLS_COPY.perMonth(formatUsd(form.monthlyUsd))}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
          {form.hasDeposit
            ? POOLS_COPY.atTodaysFees
            : POOLS_COPY.onReferenceDeposit(formatUsd(REFERENCE_DEPOSIT_USD))}
        </SizableText>
      </PlanRow>,
    );
  }
  if (versus.fraction < -0.0005) {
    rows.push(
      <PlanRow
        key="versus"
        label={POOLS_COPY.versusHoldingLabel(
          getPoolPair(pool).base.symbol,
          `${versus.move * 100}%`,
        )}
      >
        <SizableText size="$bodyMdMedium" textAlign="right">
          {POOLS_COPY.lessThanHolding(formatUsd(form.versusUsd))}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {POOLS_COPY.beforeFees}
        </SizableText>
      </PlanRow>,
    );
  }
  if (form.mode === 'zap' && form.zapPlan) {
    rows.push(
      <ZapPlanView
        key="zap"
        plan={form.zapPlan}
        pool={pool}
        input={form.inputAsset}
      />,
    );
  }
  if (form.mode === 'both' && form.bothDeposit.valueUsd.gt(0)) {
    rows.push(
      <PlanRow key="goes-in" label={POOLS_COPY.goesIn}>
        <SizableText size="$bodyMdMedium">
          {formatUsd(form.bothDeposit.valueUsd)}
        </SizableText>
      </PlanRow>,
    );
    if (form.bothDeposit.shareOfPool) {
      rows.push(
        <PlanRow key="share" label={POOLS_COPY.shareOfPool}>
          <SizableText size="$bodyMdMedium">
            {`${form.bothDeposit.shareOfPool.times(100).toFixed(4)}%`}
          </SizableText>
        </PlanRow>,
      );
    }
  }
  // Range pools show the estimate beside the presets
  if (!form.isRange) {
    rows.unshift(
      <PoolAprEstimate key="estimate" estimate={form.estimate} pool={pool} />,
    );
  }
  return rows;
}

/**
 * The create-position form: range, deposit and what it comes to. The
 * caller places the Review button, inline or in the page footer. Beside the
 * pool's chart, where the range is set, the rest is one card ending in the
 * button.
 */
export function PoolPositionForm({
  form,
  ticks,
  priceHistory,
  rangeOnChart = false,
  button,
}: {
  form: IPoolPositionForm;
  ticks: IPoolTickLiquidityNet[] | undefined;
  /** Daily closes of the last 30 days */
  priceHistory: IPoolPricePoint[] | undefined;
  /** The range is set on the chart beside the form */
  rangeOnChart?: boolean;
  /** Ends the card when the range is on the chart */
  button?: ReactNode;
}) {
  const outcome = getOutcomeRows(form);
  if (rangeOnChart) {
    return (
      <PoolsCard
        title={POOLS_COPY.createPosition}
        testID="earn-pool-create-card"
      >
        <DepositFields form={form} />
        <YStack gap="$3">
          {form.isRange ? <RangeSummaryRow form={form} /> : null}
          {outcome}
        </YStack>
        {button}
      </PoolsCard>
    );
  }
  return (
    <YStack gap="$4">
      {form.isRange ? (
        <PoolsCard title={POOLS_COPY.presets} testID="earn-pool-range-card">
          {ticks ? (
            <PoolRangeEditor
              pool={form.pool}
              ticks={ticks}
              priceHistory={priceHistory ?? []}
              estimate={form.estimate}
              range={form.range}
              presetId={form.presetId}
              readOnly={Boolean(form.positionId)}
              onChange={form.setRange}
            />
          ) : (
            <YStack gap="$3">
              <Skeleton w="100%" h="$8" borderRadius="$full" />
              <Skeleton w="100%" h={120} borderRadius="$3" />
              <Skeleton w="100%" h="$16" borderRadius="$3" />
            </YStack>
          )}
        </PoolsCard>
      ) : null}
      <PoolsCard title={POOLS_COPY.deposit}>
        <DepositFields form={form} />
      </PoolsCard>
      {outcome.length ? <PoolsCard>{outcome}</PoolsCard> : null}
    </YStack>
  );
}

export function PoolPositionReviewButton({
  form,
  testID = 'earn-pool-add-review',
}: {
  form: IPoolPositionForm;
  testID?: string;
}) {
  return (
    <Button
      testID={testID}
      variant="primary"
      size="large"
      disabled={!form.canReview}
      loading={form.isBusy}
      onPress={() => void form.review()}
    >
      {form.buttonLabel}
    </Button>
  );
}
