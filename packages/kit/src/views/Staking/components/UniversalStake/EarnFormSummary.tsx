import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  HeightTransition,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnText,
  IEarnTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { EarnAmountText } from '../ProtocolDetails/EarnAmountText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
const FADE_IN = { opacity: 0 } as const;
const FADE_OUT = { opacity: 0 } as const;
// Up to this many rows show as they are; past it the rest fold under
// "Details", so the visible block stays this many lines
const VISIBLE_ROW_LIMIT = 4;
// When a row comes or goes, the rows below move in this long
const ROWS_HEIGHT_MS = 200;
// A figure being worked out again stays at this opacity until the new one
const STALE_OPACITY = 0.4;
const DETAILS_KEY = 'earn-form-details';

export type IEarnOutcomeValue = {
  main: string;
  // After the figure, quieter: its dollar value, or "(in sUSD3)"
  suffix?: string;
  // A second line under it, such as Pendle's "7.39% Gain"
  note?: string;
  tooltip?: IEarnTooltip;
};

// What the form gets you for the amount: earned in a year, received, or
// what a fixed rate pays at maturity. Shown in the same place in every form
export type IEarnOutcome = {
  label: string;
  tooltip?: IEarnTooltip;
  // None yet: a dash holds the place
  values: IEarnOutcomeValue[];
  // Earned money is green; an amount received is not
  isEarning?: boolean;
};

// Kept by the deposit modal across a protocol switch, which builds a new
// form: the new one shows the last figures, dimmed, until its own come in,
// so the rows don't go blank and come back
export const EarnOutcomeCarryContext = createContext<{
  current?: IEarnOutcome;
} | null>(null);

const stripParens = (text?: string) =>
  text?.trim().replace(/^\((.*)\)$/, '$1') || undefined;

type IEarnReward = NonNullable<
  IStakeTransactionConfirmation['rewards']
>[number];

// A result line is an amount ("0.0001 ETH", "< $0.01"); a line such as
// Lido's "Claim available in 4 days" is a row under the result instead
const AMOUNT_TEXT = /^[<≈~]?\s*[$€£¥]?\s*\d/;
const isAmountReward = (reward: IEarnReward) =>
  AMOUNT_TEXT.test(reward.title?.text?.trim() ?? '');

// The server's result lines that are not amounts, as rows: label, then its
// text, or a dash while there is no amount
export function buildRewardNoteRows({
  transactionConfirmation,
  withoutValues,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  withoutValues?: boolean;
}): ReactElement[] {
  return (transactionConfirmation?.rewards ?? [])
    .filter(
      (reward) =>
        Boolean(reward.title?.text?.trim()) && !isAmountReward(reward),
    )
    .map((reward, index) => (
      <EarnFormRow
        key={`reward-note-${index}`}
        label={reward.title.text.trim()}
        tooltip={reward.tooltip}
        value={
          withoutValues || !reward.description?.text?.trim() ? undefined : (
            <SizableText size="$bodyMdMedium" textAlign="right">
              {reward.description.text.trim()}
            </SizableText>
          )
        }
      />
    ));
}

// The server's rewards for an amount ("Est. annual rewards" and a row per
// reward token) as one result
export function buildRewardsOutcome({
  transactionConfirmation,
  placeholderLabel,
  withoutValues,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  placeholderLabel: string;
  // No amount yet: the label stays, the figures wait
  withoutValues?: boolean;
}): IEarnOutcome {
  const rewards = withoutValues
    ? []
    : (transactionConfirmation?.rewards ?? []).filter(
        (reward) =>
          Boolean(reward.title?.text?.trim()) && isAmountReward(reward),
      );
  return {
    label: transactionConfirmation?.title?.text?.trim() || placeholderLabel,
    tooltip: transactionConfirmation?.tooltip,
    values: rewards.map((reward) => ({
      main: reward.title.text.trim(),
      suffix: stripParens(reward.description?.text),
      tooltip: reward.tooltip,
    })),
    isEarning: true,
  };
}

// A server row's text as a result: "1.3719 USDC (in sUSD3)\n7.39% Gain"
export function buildOutcomeValueFromText(
  text?: IEarnText,
): IEarnOutcomeValue | undefined {
  const lines = (text?.text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines[0]) {
    return undefined;
  }
  const match = lines[0].match(/^(.*?)(\s*\([^()]*\))$/);
  return {
    main: match?.[1]?.trim() || lines[0],
    suffix: match?.[2]?.trim(),
    note: lines[1],
  };
}

type IPendleRewardRow = {
  title: IEarnText;
  description: IEarnText;
  tooltip?: IEarnTooltip;
};

const isPercentRow = (row: IPendleRewardRow) =>
  row.description.text.trim().endsWith('%');

// A plain date such as "17 Dec 2026"
const isDateRow = (row: IPendleRewardRow) => {
  const text = row.description.text.trim();
  return (
    !text.includes('\n') &&
    !text.includes('%') &&
    /[a-z]/i.test(text) &&
    !Number.isNaN(Date.parse(text))
  );
};

// Pendle's rows for an amount, as the form shows them: what you get at
// maturity is the result, the rates stay as rows, and the maturity date is
// left out (the protocol row and the page header show it)
export function splitPendleRewardRows(rows: IPendleRewardRow[]) {
  const outcomeRow = rows
    .toReversed()
    .find((row) => !isPercentRow(row) && !isDateRow(row));
  return {
    outcomeRow,
    detailRows: rows.filter((row) => row !== outcomeRow && !isDateRow(row)),
  };
}

function Dash() {
  return (
    <SizableText size="$bodyMdMedium" color="$textDisabled">
      –
    </SizableText>
  );
}

function OutcomeValues({
  outcome,
  isLoading,
}: {
  outcome: IEarnOutcome;
  isLoading?: boolean;
}) {
  if (!outcome.values.length) {
    // About as wide as the figure that comes. Keyed apart from the
    // figures' animated stack, which uses other hooks
    return isLoading ? (
      <YStack key="skeleton" py="$0.5">
        <Skeleton.BodyLg w={120} />
      </YStack>
    ) : (
      <SizableText size="$bodyLgMedium" color="$textDisabled">
        –
      </SizableText>
    );
  }
  return (
    <YStack
      key="values"
      ai="flex-end"
      gap="$1"
      // A new figure on its way: the last one stays, dimmed
      opacity={isLoading ? STALE_OPACITY : 1}
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
    >
      {outcome.values.map((value) => (
        <YStack
          // A new figure fades in where the last one was
          key={`${value.main}|${value.suffix ?? ''}|${value.note ?? ''}`}
          ai="flex-end"
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={FADE_IN}
        >
          <XStack gap="$1.5" ai="center" jc="flex-end" flexWrap="wrap">
            <EarnAmountText
              size="$bodyLgMedium"
              color={outcome.isEarning ? '$textSuccess' : '$text'}
              fontVariant={TABULAR_NUMS}
              textAlign="right"
            >
              {value.main}
            </EarnAmountText>
            {value.suffix ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                fontVariant={TABULAR_NUMS}
              >
                {value.suffix}
              </SizableText>
            ) : null}
            {value.tooltip ? (
              <EarnTooltip title={value.main} tooltip={value.tooltip} />
            ) : null}
          </XStack>
          {value.note ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {value.note}
            </SizableText>
          ) : null}
        </YStack>
      ))}
    </YStack>
  );
}

function RowLabel({
  label,
  tooltip,
  minHeight,
}: {
  label: string;
  tooltip?: IEarnTooltip;
  minHeight?: '$6';
}) {
  return (
    <XStack ai="center" gap="$1" flexShrink={1} minHeight={minHeight}>
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      {tooltip ? <EarnTooltip title={label} tooltip={tooltip} /> : null}
    </XStack>
  );
}

export function EarnOutcomeRow({
  outcome,
  isLoading,
  testID,
}: {
  outcome: IEarnOutcome;
  isLoading?: boolean;
  testID?: string;
}) {
  return (
    <XStack testID={testID} jc="space-between" ai="flex-start" gap="$3">
      <RowLabel
        label={outcome.label}
        tooltip={outcome.tooltip}
        minHeight="$6"
      />
      <YStack flexShrink={1} ai="flex-end" minHeight="$6" jc="center">
        <OutcomeValues outcome={outcome} isLoading={isLoading} />
      </YStack>
    </XStack>
  );
}

/**
 * A row under the result: a label on the left and its value, or a dash
 * while there is no amount yet
 */
export function EarnFormRow({
  label,
  tooltip,
  value,
  testID,
}: {
  label: string;
  tooltip?: IEarnTooltip;
  value?: ReactNode;
  testID?: string;
}) {
  // Top-aligned, so a value with a second line keeps its first line level
  // with the label
  return (
    <XStack testID={testID} jc="space-between" ai="flex-start" gap="$3">
      <RowLabel label={label} tooltip={tooltip} />
      <XStack flexShrink={1} jc="flex-end" ai="center">
        {value ?? <Dash />}
      </XStack>
    </XStack>
  );
}

function EarnFormDetails({ rows }: { rows: ReactElement[] }) {
  const intl = useIntl();
  return (
    <Accordion
      overflow="hidden"
      width="100%"
      type="single"
      collapsible
      defaultValue=""
    >
      <Accordion.Item value={DETAILS_KEY}>
        {/* A row like the others, quieter than the figures it hides */}
        <Accordion.Trigger
          unstyled
          flexDirection="row"
          alignItems="center"
          width="100%"
          p={0}
          justifyContent="space-between"
          borderWidth={0}
          bg="$transparent"
          userSelect="none"
          cursor="pointer"
        >
          {({ open }: { open: boolean }) => (
            <>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.global_details })}
              </SizableText>
              <YStack
                transition="fast"
                animateOnly={ANIMATE_ONLY_TRANSFORM}
                rotate={open ? '180deg' : '0deg'}
              >
                <Icon
                  name="ChevronDownSmallOutline"
                  color="$iconSubdued"
                  size="$5"
                />
              </YStack>
            </>
          )}
        </Accordion.Trigger>
        <Accordion.HeightAnimator transition="fast">
          <Accordion.Content
            transition="fast"
            animateOnly={ANIMATE_ONLY_OPACITY}
            exitStyle={FADE_OUT}
            px={0}
            pb={0}
            pt="$3"
            gap="$3"
          >
            {rows}
          </Accordion.Content>
        </Accordion.HeightAnimator>
      </Accordion.Item>
    </Accordion>
  );
}

/**
 * The part of a deposit or withdraw form under its amount and protocol: the
 * result first, then the form's own rows, all on the background with their
 * text in line with the boxes' text above. Past four rows the rest fold
 * under "Details"
 */
export function EarnFormSummary({
  outcome,
  isLoading,
  isOutcomeLoading = isLoading,
  rows = [],
  footnote,
}: {
  outcome?: IEarnOutcome;
  // A new amount's figures on their way
  isLoading?: boolean;
  // When the result is worked out without the server, it doesn't wait
  isOutcomeLoading?: boolean;
  rows?: ReactElement[];
  footnote?: ReactNode;
}) {
  const carry = useContext(EarnOutcomeCarryContext);
  // Rows there from the first frame show at once; rows that come later open
  const [hasRowsFromStart] = useState(rows.length > 0);
  const hasOwnValues = Boolean(outcome?.values.length);
  useEffect(() => {
    if (carry && outcome && hasOwnValues) {
      carry.current = outcome;
    }
  }, [carry, hasOwnValues, outcome]);
  // Until this form's own figures are in, the last form's stay, dimmed: only
  // the same result (a vault's year for a vault's), never Pendle's for one
  const carried =
    !hasOwnValues &&
    isOutcomeLoading &&
    carry?.current &&
    carry.current.label === outcome?.label
      ? carry.current
      : undefined;
  const shownOutcome = carried ?? outcome;
  const shouldFold = rows.length > VISIBLE_ROW_LIMIT;
  const visibleRows = shouldFold ? rows.slice(0, VISIBLE_ROW_LIMIT - 1) : rows;
  const foldedRows = shouldFold ? rows.slice(VISIBLE_ROW_LIMIT - 1) : [];
  if (!shownOutcome && !rows.length && !footnote) {
    return null;
  }
  // Each part brings its own space above it, so a part that is not there
  // (or is still opening) leaves no gap
  return (
    <YStack px="$3.5">
      {shownOutcome ? (
        <EarnOutcomeRow
          testID="earn-form-outcome"
          outcome={shownOutcome}
          isLoading={isOutcomeLoading}
        />
      ) : null}
      <HeightTransition
        duration={ROWS_HEIGHT_MS}
        skipInitialAnimation={hasRowsFromStart}
      >
        {rows.length ? (
          <YStack
            pt={shownOutcome ? '$3' : undefined}
            gap="$3"
            opacity={isLoading ? STALE_OPACITY : 1}
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
          >
            {visibleRows}
            {foldedRows.length ? <EarnFormDetails rows={foldedRows} /> : null}
          </YStack>
        ) : null}
      </HeightTransition>
      {footnote ? <YStack pt="$3">{footnote}</YStack> : null}
    </YStack>
  );
}
