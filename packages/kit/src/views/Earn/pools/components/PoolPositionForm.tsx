import { useMemo } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  SegmentControl,
  SizableText,
  Skeleton,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import type { ITokenSelectorPopoverProps } from '@onekeyhq/kit/src/components/AmountInput';
import { validateAmountInputForStaking } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPoolPricePoint,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import {
  formatPercent,
  formatUsd,
  getPoolPair,
  getRangeLine,
} from '../poolsFormat';
import { isCostlySwap } from '../poolsOutcome';
import { toInputAmount, usdOf } from '../usePoolPositionForm';

import { PoolAprEstimate } from './PoolAprEstimate';
import { PoolRangeEditor, PoolRangeFigures } from './PoolRangeEditor';
import { PoolsCard } from './PoolsCard';
import { PoolsChip } from './PoolsFilterButton';
import { PoolTokenList } from './PoolTokenList';

import type { IPoolAddMode, IPoolPositionForm } from '../usePoolPositionForm';

// Remove's quick picks; Max is already on the balance line
const PERCENT_CHIPS = [0.25, 0.5, 0.75];

function PlanRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <XStack jc="space-between" ai="flex-start" gap="$3">
      {/* The label keeps one line; a long value wraps instead */}
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <YStack ai="flex-end" gap="$0.5" flexShrink={1}>
        {children}
      </YStack>
    </XStack>
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
            {POOLS_COPY.payWithNative(form.nativeAsset.symbol)}
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
  const intl = useIntl();
  const { inputAsset, amountIn, zapInputs, balanceOf, selectInputAsset } = form;
  // Opens from the token button itself, as Market's swap panel does. One
  // component per token set: a new one on every render would remount the list.
  const tokenPopover = useMemo<ITokenSelectorPopoverProps>(
    () => ({
      title: intl.formatMessage({ id: ETranslations.dexmarket_select_token }),
      content: ({ closePopover }) => (
        <PoolTokenList
          testIDPrefix="earn-pool-add-token"
          assets={zapInputs}
          balanceOf={balanceOf}
          onSelect={(asset) => {
            selectInputAsset(asset.id);
            closePopover();
          }}
        />
      ),
    }),
    [balanceOf, intl, selectInputAsset, zapInputs],
  );
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
          popover: tokenPopover,
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
              label={`${percent * 100}%`}
              raised
              active={Boolean(value) && amountIn === value}
              onPress={() => form.setAmountIn(value)}
            />
          );
        })}
      </XStack>
    </YStack>
  );
}

/** One token or both */
function DepositModeSwitch({
  form,
  fullWidth = false,
}: {
  form: IPoolPositionForm;
  fullWidth?: boolean;
}) {
  return (
    <SegmentControl
      fullWidth={fullWidth}
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
  );
}

/** The amounts the chosen mode asks for */
function DepositInputs({ form }: { form: IPoolPositionForm }) {
  const { inverted } = getPoolPair(form.pool);
  const onlySide = form.shape === 'token0Only' ? 0 : 1;
  if (!form.wallet) {
    return (
      <YStack gap="$3">
        <Skeleton w="100%" h={104} borderRadius="$3" />
        <Skeleton w="$48" h="$7" borderRadius="$full" />
      </YStack>
    );
  }
  if (form.mode === 'zap') {
    return <ZapInput form={form} />;
  }
  if (form.shape === 'both') {
    return (
      <YStack gap="$3">
        {(inverted ? ([1, 0] as const) : ([0, 1] as const)).map((side) => (
          <SideInput key={side} form={form} side={side} />
        ))}
      </YStack>
    );
  }
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {POOLS_COPY.onlyToken(form.tokens[onlySide].symbol)}
      </SizableText>
      <SideInput form={form} side={onlySide} />
    </YStack>
  );
}

/**
 * The range set on the chart, so the card shows everything the position
 * takes, also with the chart scrolled away or after a copied range. It reads
 * the prices the way the chart shows them.
 */
function RangeSummaryRow({ form }: { form: IPoolPositionForm }) {
  const line = getRangeLine(form.pool, form.range, form.flipped);
  return (
    <PlanRow label={POOLS_COPY.priceRange}>
      <SizableText
        testID="earn-pool-create-range"
        size="$bodyMdMedium"
        textAlign="right"
      >
        {line.text}
      </SizableText>
      {line.unit ? (
        <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
          {line.unit}
        </SizableText>
      ) : null}
    </PlanRow>
  );
}

/**
 * What the deposit comes to; empty until there is something to show. Money
 * waits for an amount: before one, the APR already gives the earnings rate
 * and the move against holding is a share.
 */
function getOutcomeRows(form: IPoolPositionForm) {
  const { pool, versus } = form;
  const rows: ReactNode[] = [];
  if (form.monthlyUsd) {
    rows.push(
      <PlanRow key="earnings" label={POOLS_COPY.estimatedEarnings}>
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          {POOLS_COPY.perMonth(formatUsd(form.monthlyUsd))}
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
        <SizableText
          testID="earn-pool-versus-holding"
          size="$bodyMdMedium"
          textAlign="right"
        >
          {POOLS_COPY.lessThanHolding(
            form.hasDeposit
              ? formatUsd(form.versusUsd)
              : formatPercent(-versus.fraction),
          )}
        </SizableText>
      </PlanRow>,
    );
  }
  // The review's rule: the swap and what goes in show as its steps; only a
  // swap that costs a lot earns a row here
  const plan = form.mode === 'zap' ? form.zapPlan : undefined;
  if (plan && isCostlySwap(plan.costUsd, plan.depositUsd)) {
    rows.push(
      <PlanRow key="swap-cost" label={POOLS_COPY.swapCost}>
        <SizableText
          testID="earn-pool-add-swap-cost"
          size="$bodyMdMedium"
          color="$textCaution"
        >
          {formatUsd(plan.costUsd)}
        </SizableText>
      </PlanRow>,
    );
  }
  // Range pools show the estimate with the range's figures
  if (!form.isRange) {
    rows.unshift(
      <PoolAprEstimate key="estimate" estimate={form.estimate} pool={pool} />,
    );
  }
  return rows;
}

/**
 * The create-position form as one card: how much (the deposit), where (the
 * range, right under it), what the two come to, then the Review button when
 * the page has no footer for it. Beside a price chart that sets the range,
 * the card shows the range as a row.
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
  /** Ends the card; pages with a footer keep the button there */
  button?: ReactNode;
}) {
  const outcome = getOutcomeRows(form);
  if (rangeOnChart) {
    return (
      <PoolsCard
        title={POOLS_COPY.createPosition}
        testID="earn-pool-create-card"
      >
        <DepositModeSwitch form={form} fullWidth />
        <DepositInputs form={form} />
        <YStack gap="$3">
          {form.isRange ? <RangeSummaryRow form={form} /> : null}
          {outcome}
        </YStack>
        {button}
      </PoolsCard>
    );
  }
  let range: ReactNode = null;
  if (form.isRange) {
    range = ticks ? (
      <PoolRangeEditor
        pool={form.pool}
        ticks={ticks}
        priceHistory={priceHistory ?? []}
        estimate={form.estimate}
        range={form.range}
        presets={form.presets}
        presetId={form.presetId}
        readOnly={Boolean(form.positionId)}
        onChange={form.setRange}
        onInvalidChange={form.setRangeInputInvalid}
      />
    ) : (
      <YStack gap="$3">
        <Skeleton w="$24" h="$5" borderRadius="$2" />
        <Skeleton w="100%" h={140} borderRadius="$3" />
        <Skeleton w="100%" h="$8" borderRadius="$full" />
        <Skeleton w="100%" h="$16" borderRadius="$3" />
      </YStack>
    );
  }
  // The amount and the range sit together; the results wait for both and
  // meet the button
  const results = form.isRange
    ? [
        <PoolRangeFigures
          key="figures"
          pool={form.pool}
          estimate={form.estimate}
          range={form.range}
          priceHistory={priceHistory ?? []}
        />,
        ...outcome,
      ]
    : outcome;
  return (
    <PoolsCard testID="earn-pool-create-card" gap="$5">
      <YStack gap="$3">
        <XStack ai="center" jc="space-between" gap="$3">
          <SizableText size="$headingSm">{POOLS_COPY.deposit}</SizableText>
          <DepositModeSwitch form={form} />
        </XStack>
        <DepositInputs form={form} />
      </YStack>
      {range ? <YStack testID="earn-pool-range-card">{range}</YStack> : null}
      {results.length ? <YStack gap="$3">{results}</YStack> : null}
      {button}
    </PoolsCard>
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
