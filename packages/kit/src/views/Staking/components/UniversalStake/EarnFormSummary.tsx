import type { ReactElement, ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import type { IColorTokens, IElement } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IEarnEstimateFeeResp,
  IEarnText,
  IEarnTooltip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import {
  easeModalHeightChanges,
  getModalRoomToGrow,
} from '../../hooks/useFitModalHeight';
import { EarnFadingPlaceholder } from '../EarnFadingPlaceholder';
import { EarnAmountText } from '../ProtocolDetails/EarnAmountText';
import { EarnTooltip } from '../ProtocolDetails/EarnTooltip';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];
const FADE_IN = { opacity: 0 } as const;
const FADE_OUT = { opacity: 0 } as const;
// Up to this many rows show as they are; past it the rest fold under
// "Details", so the visible block stays this many lines
const VISIBLE_ROW_LIMIT = 4;
// Folded, the rows above "Details"
export const SHOWN_ROWS_WHEN_FOLDED = VISIBLE_ROW_LIMIT - 1;
// When a row comes or goes, the rows below move in this long
const ROWS_HEIGHT_MS = 200;
// A figure being worked out again stays at this opacity until the new one
const STALE_OPACITY = 0.4;
const DETAILS_KEY = 'earn-form-details';
// A form's button going off while its figures are on their way, and on
// again as they land, eases between its looks
export const EARN_BUTTON_LOOK_TRANSITION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_OPACITY,
} as const;
// The accordion opens or folds over 'fast' (200 ms) and the modal follows it
// a frame behind; the rest is room for slow frames
const DETAILS_UNFOLD_MS = 450;
// Folded, a scroll the shorter form can't keep comes down within this, from
// the fold's first frame
const DETAILS_FOLD_SCROLL_MS = 150;
const easeInOut = (progress: number) =>
  progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;

// The modal's scroll area holding a node, once its content is taller than it
function findScrollArea(node: HTMLElement): HTMLElement | null {
  let el = node.parentElement;
  while (el && el !== document.body) {
    if (
      /(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

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
  // A cost (a loan's net result below zero) is red
  isCost?: boolean;
  // The figure comes with a note line under it (Pendle's gain): the line's
  // room is kept while there is no figure, so the rows below stay put
  hasNoteLine?: boolean;
  // The tokens its figures come in (Spark Savings pays USDC and a USDT
  // bonus): a line for each in every state, so the figures come in where
  // their lines were. At rest each line shows its dash and its token; a
  // single token, the dash alone
  tokens?: string[];
};

// Kept by the deposit modal across a protocol switch, which builds a new
// form: the new one shows the last figures, dimmed, until its own come in,
// so the rows don't go blank and come back. The rows under them too: a row
// the new form only has once its answer is in (Est. receive) keeps its
// place with the last figure, dimmed
export const EarnOutcomeCarryContext = createContext<{
  current?: IEarnOutcome;
  rows?: ReactElement[];
  isLendingMarket?: boolean;
} | null>(null);

// The carried rows in their order, each this form's own where it has the
// same row already; then this form's rows the last one didn't have
function mergeCarriedRows(carried: ReactElement[], own: ReactElement[]) {
  const ownByKey = new Map(own.map((row) => [row.key, row]));
  const carriedKeys = new Set(carried.map((row) => row.key));
  return [
    ...carried.map((row) => ownByKey.get(row.key) ?? row),
    ...own.filter((row) => !carriedKeys.has(row.key)),
  ];
}

// From a pick in the deposit modal's protocol list until the form is the
// picked protocol's (the list folds first): the figures on screen dim, as
// they are about to change, and the button doesn't act for the protocol
// being left
export const EarnFormSwitchingContext = createContext(false);

// A new amount's figures on their way: the values on screen dim (never the
// labels), and a row with no value yet holds a placeholder its size. A
// switch only dims: a dash stays a dash
const EarnFormQuotingContext = createContext({
  isQuoting: false,
  isDimmed: false,
});

/** Whether the rows' figures are on their way, for parts that aren't rows */
export function useEarnFormQuoting() {
  return useContext(EarnFormQuotingContext);
}

/**
 * The network fee row's figure, which has an answer of its own that comes
 * before or after the rest: this amount's estimate once it is in; until
 * then the figure on screen stays, dimmed, or a placeholder holds the place
 * where there was none. Through a moment's empty box it stays with the
 * other figures; left empty, a dash, and the next amount starts from a
 * placeholder. A zero estimate counts as none
 */
export function useEarnFeeFigure({
  fee,
  feeAmount,
  amountValue,
  isPositiveAmount,
  hasShownFigures,
}: {
  fee?: IEarnEstimateFeeResp;
  // The amount that estimate is for ('' for none)
  feeAmount?: string;
  amountValue: string;
  isPositiveAmount: boolean;
  // The other figures are on screen (this amount's, or dimmed, the last's),
  // or their placeholders through an emptied box's moment
  hasShownFigures: boolean;
}) {
  // What the row showed last: a figure, a placeholder (an estimate on its
  // way) or a dash (an answer without a fee)
  const shownRef = useRef<{
    fee?: IEarnEstimateFeeResp;
    isLoading: boolean;
  }>({ isLoading: false });
  let shownFee: IEarnEstimateFeeResp | undefined;
  let isFeeLoading = false;
  if (isPositiveAmount && feeAmount === amountValue) {
    shownFee = fee && Number(fee.feeFiatValue) > 0 ? fee : undefined;
  } else if (isPositiveAmount) {
    shownFee = shownRef.current.fee;
    isFeeLoading = true;
  } else if (hasShownFigures) {
    // Through an emptied box's moment the row stays as it was: a figure
    // (dimmed) or a placeholder; a dash stays a dash, nothing being on its
    // way
    shownFee = shownRef.current.fee;
    isFeeLoading = Boolean(shownFee) || shownRef.current.isLoading;
  }
  shownRef.current = { fee: shownFee, isLoading: isFeeLoading };
  return { shownFee, isFeeLoading };
}

const stripParens = (text?: string) =>
  text?.trim().replace(/^\((.*)\)$/, '$1') || undefined;

// A money amount with one decimal ("$0.1") gets its second, as every other
// money figure in the form shows two
const padCents = (text: string) =>
  text.replace(/^([<≈~]?\s*[$€£¥]\s?\d[\d,]*\.\d)$/, '$10');

type IEarnReward = NonNullable<
  IStakeTransactionConfirmation['rewards']
>[number];

// A result line is an amount ("0.0001 ETH", "< $0.01"); a line such as
// Lido's "Claim available in 4 days" is a row under the result instead
const AMOUNT_TEXT = /^[<≈~]?\s*[$€£¥]?\s*\d/;
const isAmountReward = (reward: IEarnReward) =>
  AMOUNT_TEXT.test(reward.title?.text?.trim() ?? '');

// The token an amount names ("0.038 USDC", "0.0<subscripts>5</subscripts>2
// PT"); none for a money amount ("< $0.01")
function readAmountToken(text: string): string | undefined {
  return (
    text
      .replace(/<[^>]+>/g, '')
      .replace(/^[<≈~]?\s*[$€£¥]?\s*[\d.,]+/, '')
      .trim() || undefined
  );
}

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
  offerTokens,
}: {
  transactionConfirmation?: IStakeTransactionConfirmation;
  placeholderLabel: string;
  // No amount yet: the label stays, the figures wait
  withoutValues?: boolean;
  // The tokens the offer pays in, from its own rates (useEarnRewardTokens);
  // without them, the tokens this answer names
  offerTokens?: string[];
}): IEarnOutcome {
  const amountRewards = (transactionConfirmation?.rewards ?? []).filter(
    (reward) => Boolean(reward.title?.text?.trim()) && isAmountReward(reward),
  );
  const answerTokens = amountRewards
    .map((reward) => readAmountToken(reward.title.text.trim()))
    .filter((token): token is string => Boolean(token));
  return {
    tokens: offerTokens?.length ? offerTokens : answerTokens,
    label: transactionConfirmation?.title?.text?.trim() || placeholderLabel,
    tooltip: transactionConfirmation?.tooltip,
    values: withoutValues
      ? []
      : amountRewards.map((reward) => ({
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

/**
 * Rows' keys by their labels: a row holding its place (its label, with a
 * dash or a placeholder) and the same row with its figure are one row, so
 * the figure comes in where the placeholder was and the label stays put. A
 * label met again gets its count after it
 */
export function buildRowKeys(labels: string[], prefix = 'row'): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    return count ? `${prefix}-${label}-${count}` : `${prefix}-${label}`;
  });
}

// A dash, or one with its token ("– USDT"). One that comes after the first
// frame (an emptied box's figures going back to dashes) fades in, as the
// figures do
function Dash({ token, fadesIn }: { token?: string; fadesIn: boolean }) {
  // As it mounts, and kept: a view that gained an enterStyle later would be
  // drawn again as a new view
  const [entryFadesIn] = useState(fadesIn);
  return (
    <YStack
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      enterStyle={entryFadesIn ? FADE_IN : undefined}
    >
      <SizableText size="$bodyMdMedium" color="$textDisabled">
        {token ? `– ${token}` : '–'}
      </SizableText>
    </YStack>
  );
}

// A row's value line, which a placeholder holds while there is no value
const VALUE_LINE_HEIGHT = 20;
const VALUE_PLACEHOLDER_WIDTH = 64;

/**
 * A row's value: dimmed while a new amount's figures are on their way, then
 * the new figure in its place, brightening. With no value yet, a dash, or a
 * placeholder the size of a value while one is coming; the value fades in
 * as the placeholder fades out, as the result and the line under the box do
 */
export function EarnFormValue({
  children,
  isLoading,
}: {
  children?: ReactNode;
  // A figure with an answer of its own (the network fee) waits for that
  // answer rather than the form's
  isLoading?: boolean;
}) {
  const quoting = useContext(EarnFormQuotingContext);
  const isSwitching = useContext(EarnFormSwitchingContext);
  const isQuoting = isLoading ?? quoting.isQuoting;
  const isDimmed =
    isLoading === undefined ? quoting.isDimmed : isLoading || isSwitching;
  // A value there as the row mounts shows at once; one that comes later
  // fades in
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
  }, []);
  const hasValue = !(
    children === undefined ||
    children === null ||
    children === false
  );
  // Decided as the value appears and kept while it stays: a view that gains
  // an enterStyle after it mounted is drawn again as a new view, so its
  // first dim would jump rather than fade
  const valueFadesInRef = useRef<boolean | undefined>(undefined);
  if (!hasValue) {
    valueFadesInRef.current = undefined;
  } else if (valueFadesInRef.current === undefined) {
    valueFadesInRef.current = isMountedRef.current;
  }
  const showsPlaceholder = !hasValue && isQuoting;
  return (
    <XStack
      position="relative"
      ai="center"
      jc="flex-end"
      minHeight={VALUE_LINE_HEIGHT}
      minWidth={showsPlaceholder ? VALUE_PLACEHOLDER_WIDTH : undefined}
    >
      <EarnFadingPlaceholder
        visible={showsPlaceholder}
        leavesAtOnce={!hasValue}
        bottom={0}
      >
        <Skeleton.BodyMd w={VALUE_PLACEHOLDER_WIDTH} />
      </EarnFadingPlaceholder>
      {hasValue ? (
        <XStack
          key="value"
          ai="center"
          jc="flex-end"
          opacity={isDimmed ? STALE_OPACITY : 1}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={valueFadesInRef.current ? FADE_IN : undefined}
        >
          {children}
        </XStack>
      ) : null}
      {!hasValue && !isQuoting ? <Dash fadesIn={isMountedRef.current} /> : null}
    </XStack>
  );
}

function OutcomeValues({
  outcome,
  isLoading,
  isDimmed = isLoading,
  fadesIn = true,
}: {
  outcome: IEarnOutcome;
  isLoading?: boolean;
  // The figures are about to change (a new amount or protocol)
  isDimmed?: boolean;
  // Off for figures already on screen as the form mounts (the last
  // protocol's, carried): only figures that come later fade in
  fadesIn?: boolean;
}) {
  const hasValues = outcome.values.length > 0;
  let outcomeColor: IColorTokens = '$text';
  if (outcome.isEarning) {
    outcomeColor = '$textSuccess';
  } else if (outcome.isCost) {
    outcomeColor = '$textCritical';
  }
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
  }, []);
  // Decided as the figures appear and kept while they stay, as a row's
  // value is
  const valuesFadeInRef = useRef<boolean | undefined>(undefined);
  if (!hasValues) {
    valuesFadeInRef.current = undefined;
  } else if (valuesFadeInRef.current === undefined) {
    valuesFadeInRef.current = fadesIn;
  }
  // The note line's room, where the figure has no note (yet)
  const noteRoom =
    outcome.hasNoteLine && !outcome.values.some((value) => value.note) ? (
      <SizableText size="$bodySm" opacity={0} aria-hidden>
        {' '}
      </SizableText>
    ) : null;
  // One tree in every state, so the placeholder (on the figure's first
  // line) fades out as the figures fade in. Figures that replace figures
  // change in place: the dimmed last ones brighten into the new ones, with
  // no blank between. A line for each token the figures come in
  const tokens = outcome.tokens ?? [];
  const lineCount = Math.max(1, tokens.length);
  return (
    <YStack position="relative" ai="flex-end">
      <EarnFadingPlaceholder
        visible={!hasValues && Boolean(isLoading)}
        leavesAtOnce={!hasValues}
        ai="flex-end"
        gap="$1"
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <YStack key={index} h="$6" jc="center">
            <Skeleton.BodyLg w={96} />
          </YStack>
        ))}
      </EarnFadingPlaceholder>
      {hasValues ? (
        <YStack
          key="values"
          ai="flex-end"
          gap="$1"
          // A new figure on its way: the last one stays, dimmed
          opacity={isDimmed ? STALE_OPACITY : 1}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={valuesFadeInRef.current ? FADE_IN : undefined}
        >
          {outcome.values.map((value, index) => {
            const main = (
              <EarnAmountText
                size="$bodyLgMedium"
                color={outcomeColor}
                fontVariant={TABULAR_NUMS}
                textAlign="right"
              >
                {value.main}
              </EarnAmountText>
            );
            const suffix = value.suffix ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                fontVariant={TABULAR_NUMS}
              >
                {padCents(value.suffix)}
              </SizableText>
            ) : null;
            const tooltip = value.tooltip ? (
              <EarnTooltip title={value.main} tooltip={value.tooltip} />
            ) : null;
            return (
              <YStack key={index} ai="flex-end">
                {/* The value after the figure ("(in sUSDe)", its dollar
                    value) on the figure's line, or under it where the line
                    has no room for both */}
                <XStack
                  columnGap="$1.5"
                  ai="center"
                  jc="flex-end"
                  flexWrap="wrap"
                  minHeight="$6"
                >
                  {main}
                  {suffix}
                  {tooltip}
                </XStack>
                {value.note ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    {value.note}
                  </SizableText>
                ) : null}
              </YStack>
            );
          })}
          {/* The lines a result holds for its tokens stay where it has fewer
              figures this time */}
          {Array.from(
            { length: Math.max(0, lineCount - outcome.values.length) },
            (_, index) => (
              <YStack key={`room-${index}`} h="$6" aria-hidden />
            ),
          )}
          {noteRoom}
        </YStack>
      ) : (
        <YStack key="empty" ai="flex-end">
          <YStack ai="flex-end" gap="$1">
            {Array.from({ length: lineCount }, (_, index) => (
              <XStack key={index} h="$6" ai="center" jc="flex-end">
                {isLoading ? null : (
                  <Dash
                    token={tokens.length > 1 ? tokens[index] : undefined}
                    fadesIn={isMountedRef.current}
                  />
                )}
              </XStack>
            ))}
          </YStack>
          {noteRoom}
        </YStack>
      )}
    </YStack>
  );
}

function RowLabel({
  label,
  tooltip,
  minHeight,
  keepsOneLine,
}: {
  label: string;
  tooltip?: IEarnTooltip;
  minHeight?: '$6';
  // The label keeps its line and the figures beside it make room
  keepsOneLine?: boolean;
}) {
  // An (i) that comes after its label (with the first quote, which says
  // what the row means) fades in, as the figures beside it do
  const hasTooltipFromStartRef = useRef(Boolean(tooltip));
  return (
    <XStack
      ai="center"
      gap="$1"
      flexShrink={keepsOneLine ? 0 : 1}
      minHeight={minHeight}
    >
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={keepsOneLine ? 1 : undefined}
      >
        {label}
      </SizableText>
      {tooltip ? (
        <YStack
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={hasTooltipFromStartRef.current ? undefined : FADE_IN}
        >
          <EarnTooltip title={label} tooltip={tooltip} />
        </YStack>
      ) : null}
    </XStack>
  );
}

export function EarnOutcomeRow({
  outcome,
  isLoading,
  isDimmed,
  fadesIn,
  testID,
}: {
  outcome: IEarnOutcome;
  isLoading?: boolean;
  isDimmed?: boolean;
  fadesIn?: boolean;
  testID?: string;
}) {
  // A result with a note line (Pendle's gain) keeps its figure and the
  // value after it ("(in sUSDe)") on one line: where they don't fit beside
  // the label, the label takes a second line, beside the note's, so the
  // rows below stay put as the figure comes in
  const keepsFigureLine = Boolean(outcome.hasNoteLine);
  return (
    // A long result (rewards of 100 a year and more on a narrow form) puts
    // its money value under the amount; the label stays on its line
    <XStack testID={testID} jc="space-between" ai="flex-start" gap="$3">
      <RowLabel
        label={outcome.label}
        tooltip={outcome.tooltip}
        minHeight="$6"
        keepsOneLine={!keepsFigureLine}
      />
      <YStack
        flexShrink={keepsFigureLine ? 0 : 1}
        minWidth={0}
        maxWidth={keepsFigureLine ? '75%' : undefined}
        ai="flex-end"
        minHeight="$6"
        jc="center"
      >
        <OutcomeValues
          outcome={outcome}
          isLoading={isLoading}
          isDimmed={isDimmed}
          fadesIn={fadesIn}
        />
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
  note,
  isLoading,
  testID,
}: {
  label: string;
  tooltip?: IEarnTooltip;
  value?: ReactNode;
  // A line under the value that doesn't change with the amount (Health
  // Factor's liquidation line): it never dims
  note?: ReactNode;
  // The value's own answer on its way, where it has one
  isLoading?: boolean;
  testID?: string;
}) {
  const valueLine = (
    <XStack flexShrink={1} jc="flex-end" ai="center">
      <EarnFormValue isLoading={isLoading}>{value}</EarnFormValue>
    </XStack>
  );
  // Top-aligned, so a value with a second line keeps its first line level
  // with the label
  return (
    <XStack testID={testID} jc="space-between" ai="flex-start" gap="$3">
      <RowLabel label={label} tooltip={tooltip} />
      {note ? (
        <YStack flexShrink={1} ai="flex-end">
          {valueLine}
          {note}
        </YStack>
      ) : (
        valueLine
      )}
    </XStack>
  );
}

// A row that comes after the first frame (a market's Health Factor once its
// answer is in) fades in as the block opens for it
function EarnFormRowEntry({
  fadesIn,
  children,
}: {
  fadesIn: boolean;
  children: ReactNode;
}) {
  // As the row mounts, and kept: the row would be drawn again as a new
  // view if it gained an enterStyle later
  const [entryFadesIn] = useState(fadesIn);
  return (
    <YStack
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      enterStyle={entryFadesIn ? FADE_IN : undefined}
    >
      {children}
    </YStack>
  );
}

function EarnFormDetails({ rows }: { rows: ReactElement[] }) {
  const intl = useIntl();
  // Opened at the bottom of a modal at its full height (Pendle's route), the
  // rows it folds would go under the edge: the form scrolls with them as they
  // unfold, each frame the least that keeps their drawn bottom (the edge of
  // the height animating open) in view, so it is one movement rather than a
  // scroll once they are open. Whatever was under the edge before the press
  // comes into view in step with the unfold. Folded again, a scroll the
  // shorter form can't keep comes back down in step with the fold, rather
  // than in the frames where the fold reaches it. A scroll of the user's own
  // stops it
  const animatorRef = useRef<IElement>(null);
  const unfoldFrameRef = useRef(0);
  useEffect(() => () => cancelAnimationFrame(unfoldFrameRef.current), []);
  const handleValueChange = useCallback((value: string) => {
    cancelAnimationFrame(unfoldFrameRef.current);
    if (!platformEnv.isRuntimeBrowser) {
      return;
    }
    const isOpening = value === DETAILS_KEY;
    const startedAt = performance.now();
    let scrolledTo: number | undefined;
    let underAtStart: number | undefined;
    let foldFrom: { top: number; extra: number; height: number } | undefined;
    let foldStartedAt: number | undefined;
    const follow = () => {
      const animator = animatorRef.current as unknown as HTMLElement | null;
      const area = animator ? findScrollArea(animator) : null;
      if (animator && area) {
        // Where it was left, or as far as the shorter content allows
        if (
          scrolledTo !== undefined &&
          Math.abs(
            area.scrollTop -
              Math.min(scrolledTo, area.scrollHeight - area.clientHeight),
          ) > 0.5
        ) {
          return;
        }
        const drawn = animator.getBoundingClientRect();
        if (isOpening) {
          const visibleBottom =
            area.getBoundingClientRect().top + area.clientHeight;
          const under = drawn.bottom - visibleBottom;
          const full =
            animator.firstElementChild?.getBoundingClientRect().height ?? 0;
          const unfolded = full > 0 ? Math.min(1, drawn.height / full) : 0;
          underAtStart ??= Math.max(0, under);
          const stillUnder = underAtStart * (1 - unfolded);
          // What a modal still growing to fit can't take: scrolled for the
          // rest, it would be clamped back as it grows
          const beyondModal = under - stillUnder - getModalRoomToGrow(animator);
          if (beyondModal > 0.5) {
            area.scrollTop += beyondModal;
          }
        } else {
          foldFrom ??= {
            top: area.scrollTop,
            extra: area.scrollHeight - area.clientHeight,
            height: drawn.height,
          };
          // Where the scroll ends once they are folded: where it is, unless
          // the shorter content can't keep it there
          const settled = Math.min(
            foldFrom.top,
            Math.max(0, foldFrom.extra - foldFrom.height),
          );
          if (foldFrom.top - settled > 0.5 && foldFrom.height > 0) {
            const folded = Math.max(0, 1 - drawn.height / foldFrom.height);
            if (folded > 0) {
              foldStartedAt ??= performance.now();
            }
            // In step with the fold, there by the point the content would
            // push it there, and no later than an even curve from the fold's
            // first frame: the fold speeds up, and would otherwise take most
            // of it in a frame or two
            const pushedAt = (foldFrom.extra - settled) / foldFrom.height;
            const inStep = pushedAt > 0 ? Math.min(1, folded / pushedAt) : 1;
            const inTime =
              foldStartedAt === undefined
                ? 0
                : easeInOut(
                    Math.min(
                      1,
                      (performance.now() - foldStartedAt) /
                        DETAILS_FOLD_SCROLL_MS,
                    ),
                  );
            area.scrollTop =
              foldFrom.top -
              (foldFrom.top - settled) * Math.max(inStep, inTime);
          }
        }
        scrolledTo = area.scrollTop;
      }
      if (performance.now() - startedAt < DETAILS_UNFOLD_MS) {
        unfoldFrameRef.current = requestAnimationFrame(follow);
      }
    };
    unfoldFrameRef.current = requestAnimationFrame(follow);
  }, []);
  return (
    <Accordion
      overflow="hidden"
      width="100%"
      type="single"
      collapsible
      defaultValue=""
      onValueChange={handleValueChange}
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
        <Accordion.HeightAnimator ref={animatorRef} transition="fast">
          <Accordion.Content
            transition="fast"
            animateOnly={ANIMATE_ONLY_OPACITY}
            exitStyle={FADE_OUT}
            px={0}
            pb={0}
            pt="$3"
          >
            <YStack gap="$3">{rows}</YStack>
          </Accordion.Content>
        </Accordion.HeightAnimator>
      </Accordion.Item>
    </Accordion>
  );
}

// "Details" before there is anything to open: in its place, its chevron
// quiet, until the rows it folds are in
function EarnFormDetailsPlaceholder() {
  const intl = useIntl();
  return (
    <XStack ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_details })}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" color="$iconDisabled" size="$5" />
    </XStack>
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
  isDimmed = false,
  rows = [],
  footnote,
  detailsPlaceholder,
  isLendingMarket,
}: {
  outcome?: IEarnOutcome;
  // A new amount's figures on their way
  isLoading?: boolean;
  // When the result is worked out without the server, it doesn't wait
  isOutcomeLoading?: boolean;
  // The figures dim with nothing on its way (an emptied box's moment after
  // an answer without them): a dash stays a dash, no placeholder comes
  isDimmed?: boolean;
  rows?: ReactElement[];
  footnote?: ReactNode;
  // The rows are stand-ins for ones that will fold: "Details" holds its
  // place under them
  detailsPlaceholder?: boolean;
  // A lending market's form (My supply, Health factor), whose rows are not
  // a vault's
  isLendingMarket?: boolean;
}) {
  const carry = useContext(EarnOutcomeCarryContext);
  const isSwitching = useContext(EarnFormSwitchingContext);
  // Figures there as the form mounts are on screen already (the last
  // protocol's, carried over a switch): only figures that come later fade in
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);
  const hasOwnValues = Boolean(outcome?.values.length);
  // The modal lets go of them once the box is emptied. Only settled figures
  // are kept: ones dimmed for an amount no longer typed (the box emptied a
  // moment) would come back for the next amount
  useEffect(() => {
    if (carry && outcome && hasOwnValues && !isOutcomeLoading) {
      carry.current = outcome;
      carry.rows = isLoading ? undefined : rows;
      carry.isLendingMarket = isLendingMarket;
    }
  }, [
    carry,
    hasOwnValues,
    isLendingMarket,
    isLoading,
    isOutcomeLoading,
    outcome,
    rows,
  ]);
  // Until this form's own figures are in, the last form's stay, dimmed: only
  // the same result (a vault's year for a vault's), never Pendle's for one
  const carried =
    !hasOwnValues &&
    isOutcomeLoading &&
    carry?.current &&
    carry.current.label === outcome?.label
      ? carry.current
      : undefined;
  // Held in this form's own place: a line for each of its own tokens, so
  // its figures replace the carried ones without the rows below moving
  // (Spark's two rewards after Aave's one, or the other way round)
  const ownLines = Math.max(1, outcome?.tokens?.length ?? 1);
  const shownOutcome = carried
    ? {
        ...carried,
        values: carried.values.slice(0, ownLines),
        tokens: outcome?.tokens,
      }
    : outcome;
  // The form's own figures taking over from the last protocol's can change
  // the result's lines and bring rows in the same moment: the modal's height
  // eases through it, as it did through the switch
  const wasCarryingRef = useRef(false);
  useLayoutEffect(() => {
    if (wasCarryingRef.current && !carried) {
      easeModalHeightChanges();
    }
    wasCarryingRef.current = Boolean(carried);
  }, [carried]);
  // Only another form of the same kind's (a vault's for a vault's), so they
  // take the places of rows this one will have, never of rows it won't
  const carriedRows =
    carried &&
    carry?.rows &&
    Boolean(carry.isLendingMarket) === Boolean(isLendingMarket)
      ? carry.rows
      : undefined;
  const shownRows = carriedRows ? mergeCarriedRows(carriedRows, rows) : rows;
  // Rows there from the first frame show at once; rows that come later open
  const [hasRowsFromStart] = useState(shownRows.length > 0);
  const rowsQuoting = useMemo(
    () => ({
      isQuoting: Boolean(isLoading),
      isDimmed: Boolean(isLoading) || isDimmed || isSwitching,
    }),
    [isDimmed, isLoading, isSwitching],
  );
  const shouldFold = shownRows.length > VISIBLE_ROW_LIMIT;
  const visibleRows = shouldFold
    ? shownRows.slice(0, VISIBLE_ROW_LIMIT - 1)
    : shownRows;
  const foldedRows = shouldFold ? shownRows.slice(VISIBLE_ROW_LIMIT - 1) : [];
  if (!shownOutcome && !shownRows.length && !footnote) {
    return null;
  }
  // Each part brings its own space above it, so a part that is not there
  // (or is still opening) leaves no gap
  return (
    <YStack px="$3.5">
      {/* A result that takes more lines once its figures are in (a second
          reward, a wrap on a narrow form) opens for them, and the rows under
          it move down with the form rather than in one frame; the room
          around it keeps a focus ring on its (i) whole, as the rows' does */}
      {shownOutcome ? (
        <YStack my="$-1">
          <HeightTransition duration={ROWS_HEIGHT_MS} skipInitialAnimation>
            <YStack py="$1">
              <EarnOutcomeRow
                testID="earn-form-outcome"
                outcome={shownOutcome}
                isLoading={isOutcomeLoading}
                isDimmed={Boolean(isOutcomeLoading) || isDimmed || isSwitching}
                fadesIn={!isFirstRenderRef.current}
              />
            </YStack>
          </HeightTransition>
        </YStack>
      ) : null}
      {/* The block clips while it opens and closes; 4 px of room above and
          below, taken back by the margin, keep a focus ring on a row's (i)
          whole */}
      <YStack my={shownRows.length ? '$-1' : undefined}>
        <EarnFormQuotingContext.Provider value={rowsQuoting}>
          <HeightTransition
            duration={ROWS_HEIGHT_MS}
            skipInitialAnimation={hasRowsFromStart}
          >
            {shownRows.length ? (
              <YStack pt={shownOutcome ? '$4' : '$1'} pb="$1" gap="$3">
                {visibleRows.map((row, index) => (
                  <EarnFormRowEntry
                    key={row.key ?? index}
                    fadesIn={!isFirstRenderRef.current}
                  >
                    {row}
                  </EarnFormRowEntry>
                ))}
              </YStack>
            ) : null}
          </HeightTransition>
          {/* "Details" opens and folds with its own animation only: inside
              the block, the block's height would chase the unfold and show
              the rows late, the fold leaving their space to close after */}
          {shownRows.length && (foldedRows.length || detailsPlaceholder) ? (
            <YStack pt="$2" pb="$1">
              {foldedRows.length ? (
                <EarnFormDetails rows={foldedRows} />
              ) : (
                <EarnFormDetailsPlaceholder />
              )}
            </YStack>
          ) : null}
        </EarnFormQuotingContext.Provider>
      </YStack>
      {footnote ? <YStack pt="$3">{footnote}</YStack> : null}
    </YStack>
  );
}
