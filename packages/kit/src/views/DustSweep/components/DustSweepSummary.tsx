import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  Button,
  Divider,
  IconButton,
  NumberSizeableText,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { SwapTransactionResultStatus } from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import SwapCommonInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapCommonInfoItem';
import SwapProviderInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapProviderInfoItem';
import { SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE } from '@onekeyhq/kit/src/views/Swap/utils/swapDesktopCardShadow';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  numberFormat,
  numberFormatAsRenderText,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useDustSweep } from '../DustSweepProvider';
import { useDustSweepFiatFormatter } from '../hooks/useDustSweepFiatFormatter';
import { getDustSweepPresentation } from '../stateMachine';

import { DustSweepResultBreakdown } from './DustSweepResultBreakdown';
import { DustSweepSlippage } from './DustSweepSlippage';

import type { IDustSweepState } from '../stateMachine';

// Height of the summary action button; the desktop hidden-tokens row aligns to it.
export const DUST_SWEEP_ACTION_HEIGHT = 46;
// Mobile space above the action: reads as the same ~17pt as the gap between
// the info rows above it (the rows' line boxes add ~2pt of their own).
const MOBILE_ACTION_GAP = 15;
// Receive row 60 + info rows 62 + action gap + action 46 + bottom padding 33.
const MOBILE_SELECTION_FOOTER_HEIGHT = 60 + 62 + MOBILE_ACTION_GAP + 46 + 33;
// Share of the screen the mobile live sheet may take; the result scrolls inside.
const MOBILE_SHEET_MAX_HEIGHT_RATIO = 0.85;

const AMOUNT_LINE_HEIGHT = 48;
const AMOUNT_TEXT_PROPS = {
  size: '$heading5xl',
  fontSize: 40,
  lineHeight: AMOUNT_LINE_HEIGHT,
  height: AMOUNT_LINE_HEIGHT,
} as const;
const SUBSCRIPT_FONT_SIZE = Math.ceil(AMOUNT_TEXT_PROPS.fontSize * 0.6);
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const AMOUNT_FLASH_STYLE = {
  position: 'absolute',
  top: -4,
  bottom: -4,
  left: -12,
  right: -12,
} as const;

// One odometer column: the 0-9 strip slides to the current digit. Memoized so
// unchanged columns skip re-rendering their ten digits on every sweep update.
const DustSweepRollingDigit = memo(function DustSweepRollingDigit({
  digit,
  color,
}: {
  digit: number;
  color?: ColorTokens;
}) {
  const reducedMotion = useReducedMotion();
  // New columns (the total gaining digits) roll up from 0 like the others.
  const offset = useSharedValue(0);
  useEffect(() => {
    const target = -digit * AMOUNT_LINE_HEIGHT;
    offset.value = reducedMotion
      ? target
      : withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [digit, offset, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));
  return (
    <Stack height={AMOUNT_LINE_HEIGHT} overflow="hidden">
      <Animated.View style={style}>
        {DIGITS.map((item) => (
          <SizableText
            key={item}
            {...AMOUNT_TEXT_PROPS}
            color={color}
            textAlign="center"
          >
            {item}
          </SizableText>
        ))}
      </Animated.View>
    </Stack>
  );
});

type IRollingSegment =
  | { kind: 'char'; char: string }
  | { kind: 'sub'; value: number };

// The received total rolls like a slot machine as each swap lands, with a
// brief success tint behind it. It uses the shared balance formatter, so tiny
// amounts keep the subscript-zero notation (the subscript itself stays put).
function DustSweepRollingAmount({
  amount,
  symbol,
  color,
}: {
  amount: string;
  symbol?: string;
  color?: ColorTokens;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const formatterOptions = useMemo(
    () => ({ showPlusMinusSigns: true, tokenSymbol: symbol }),
    [symbol],
  );
  const segments = useMemo(() => {
    const parts = numberFormatAsRenderText(amount, {
      formatter: 'balance',
      formatterOptions: { showPlusMinusSigns: true },
    });
    const list: IRollingSegment[] = [];
    (typeof parts === 'string' ? [parts] : parts).forEach((part) => {
      if (typeof part === 'string' || part.type === 'decimal') {
        // Formatted amounts are ASCII digits, signs and separators only.
        (typeof part === 'string' ? part : part.value)
          .split('')
          .forEach((char) => list.push({ kind: 'char', char }));
      } else {
        list.push({ kind: 'sub', value: part.value });
      }
    });
    return list;
    // The formatter follows the app locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, intl.locale]);
  const flash = useSharedValue(0);
  const previous = useRef(amount);
  useEffect(() => {
    if (!reducedMotion && new BigNumber(amount).gt(previous.current)) {
      flash.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: 900 }),
      );
    }
    previous.current = amount;
  }, [amount, flash, reducedMotion]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  if (reducedMotion)
    return (
      <SizableText
        testID="dust-sweep-result-amount"
        {...AMOUNT_TEXT_PROPS}
        color={color}
        numberOfLines={1}
      >
        <NumberSizeableText
          key={intl.locale}
          size="$heading5xl"
          fontSize={40}
          lineHeight={AMOUNT_LINE_HEIGHT}
          color={color}
          formatter="balance"
          formatterOptions={formatterOptions}
        >
          {amount}
        </NumberSizeableText>
      </SizableText>
    );
  const label = `${numberFormat(amount, {
    formatter: 'balance',
    formatterOptions: { showPlusMinusSigns: true },
  })} ${symbol ?? ''}`.trim();
  return (
    // Screen readers get the amount as one element; the 0-9 strips are hidden.
    <XStack
      testID="dust-sweep-result-amount"
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      aria-label={label}
      height={AMOUNT_LINE_HEIGHT}
      alignItems="center"
    >
      <Animated.View
        pointerEvents="none"
        style={[AMOUNT_FLASH_STYLE, flashStyle]}
      >
        <Stack flex={1} bg="$bgSuccessSubdued" borderRadius="$3" />
      </Animated.View>
      {/* Web ignores a label on a plain container, so give screen readers the
          amount as visually hidden text there. */}
      {platformEnv.isNative ? null : (
        <SizableText
          position="absolute"
          width={1}
          height={1}
          overflow="hidden"
          opacity={0}
        >
          {label}
        </SizableText>
      )}
      <XStack
        alignItems="center"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {segments.map((segment, index) => {
          // Keyed from the right so the decimals keep their columns when the
          // integer part grows.
          const key = segments.length - index;
          if (segment.kind === 'sub')
            return (
              <SizableText
                key={key}
                {...AMOUNT_TEXT_PROPS}
                // Same 60% subscript as the shared number text.
                fontSize={SUBSCRIPT_FONT_SIZE}
                lineHeight={SUBSCRIPT_FONT_SIZE}
                height={SUBSCRIPT_FONT_SIZE}
                alignSelf="flex-end"
                mb={6}
                color={color}
              >
                {segment.value}
              </SizableText>
            );
          return /\d/.test(segment.char) ? (
            <DustSweepRollingDigit
              key={key}
              digit={Number(segment.char)}
              color={color}
            />
          ) : (
            <SizableText key={key} {...AMOUNT_TEXT_PROPS} color={color}>
              {segment.char}
            </SizableText>
          );
        })}
        {symbol ? (
          <SizableText {...AMOUNT_TEXT_PROPS} color={color}>
            {` ${symbol}`}
          </SizableText>
        ) : null}
      </XStack>
    </XStack>
  );
}

const WORKING_DOTS = ['', '.', '..', '...'];

// "Converting..." with the dots cycling; the dots sit in a fixed-width slot so
// the title never shifts while they grow.
function DustSweepWorkingDots() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(WORKING_DOTS.length - 1);
  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = setInterval(
      () => setStep((value) => (value + 1) % WORKING_DOTS.length),
      400,
    );
    return () => clearInterval(timer);
  }, [reducedMotion]);
  return (
    <Stack width={18}>
      <SizableText size="$headingLg">{WORKING_DOTS[step]}</SizableText>
    </Stack>
  );
}

// Live sweep view: the same layout while converting and after completion, so
// the result grows out of the progress instead of replacing it.
// Rendered inside the summary, which owns the actions.
export function DustSweepResult({
  state,
  desktop = false,
}: {
  state: IDustSweepState;
  desktop?: boolean;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const formatFiat = useDustSweepFiatFormatter();
  const { totals, outcome, completed, unknown } =
    getDustSweepPresentation(state);
  const converting = !completed && !unknown;
  const hasSuccess = totals.successCount > 0;
  const resultTitleId = {
    pending: ETranslations.global_pending,
    failed: ETranslations.dust_sweep_failed,
    partial: ETranslations.title_dust_sweep_completed,
    success: ETranslations.title_dust_swept,
  }[outcome];
  let title = intl.formatMessage({ id: resultTitleId });
  const working = converting && state.phase !== 'paused';
  if (working)
    title = intl.formatMessage({
      id: ETranslations.dust_sweep_converting__title,
    });
  else if (converting)
    title = intl.formatMessage({ id: ETranslations.sweep_dust_sweep_paused });
  const token = state.snapshot?.nativeToken;
  let value = formatFiat('0');
  if (totals.receiptUnavailable || (!converting && !hasSuccess)) value = '—';
  else if (hasSuccess)
    value = token?.price
      ? formatFiat(new BigNumber(totals.receivedAmount).times(token.price))
      : '—';
  // Web keeps entering-animated views absolutely positioned, so the result
  // would stop taking space (the mobile footer collapses); animate natively.
  const animateLayout = platformEnv.isNative;
  const entering = reducedMotion
    ? FadeIn.duration(300)
    : FadeInDown.duration(300)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ transform: [{ translateY: 24 }] });
  const graphicEntering = reducedMotion
    ? FadeIn.duration(300)
    : ZoomIn.springify().damping(14).stiffness(180);
  const allFailed = completed && outcome === 'failed';
  let graphicStatus: 'success' | 'failed' | 'pending' = 'pending';
  if (!converting) graphicStatus = outcome === 'partial' ? 'success' : outcome;
  return (
    <Stack width="100%" flexShrink={0}>
      <Animated.View
        entering={animateLayout ? entering : undefined}
        style={{ width: '100%' }}
      >
        <YStack
          testID="dust-sweep-result"
          // The status animation carries ~13pt of blank space above its art and
          // ~17pt below it; on mobile pad the sheet top more and pull the title
          // in so the graphic reads top-heavy rather than floating.
          pt={desktop ? 24 : 28}
          alignItems="center"
        >
          {/* Same success / failed / pending graphics as the Swap result;
              the pending hourglass turns into the outcome when it finishes. */}
          <Animated.View
            key={graphicStatus}
            entering={animateLayout ? graphicEntering : undefined}
          >
            <SwapTransactionResultStatus status={graphicStatus} />
          </Animated.View>
          <XStack
            testID="dust-sweep-result-title"
            mt={desktop ? '$4' : '$1'}
            height={24}
          >
            <SizableText size="$headingLg">{title}</SizableText>
            {working ? <DustSweepWorkingDots /> : null}
          </XStack>
          {allFailed ? (
            <SizableText
              testID="dust-sweep-result-subtitle"
              size="$bodyMd"
              color="$textSubdued"
              textAlign="center"
              mt="$1.5"
            >
              {intl.formatMessage(
                { id: ETranslations.dust_no_tokens_converted },
                { count: state.items.length },
              )}
            </SizableText>
          ) : (
            <>
              <Stack mt={desktop ? 6 : 8}>
                {totals.receiptUnavailable ? (
                  <SizableText
                    testID="dust-sweep-result-amount"
                    {...AMOUNT_TEXT_PROPS}
                    numberOfLines={1}
                  >
                    — {token?.symbol}
                  </SizableText>
                ) : (
                  <DustSweepRollingAmount
                    amount={totals.receivedAmount}
                    symbol={token?.symbol}
                    color={converting ? '$textSuccess' : undefined}
                  />
                )}
              </Stack>
              <SizableText
                size="$bodyLgMedium"
                color="$textSubdued"
                height={24}
                mt={desktop ? 4 : 6}
              >
                {value}
              </SizableText>
            </>
          )}
          <Divider width="100%" mt="$6" mb="$4" />
          <DustSweepResultBreakdown state={state} collapsible={!desktop} />
        </YStack>
      </Animated.View>
    </Stack>
  );
}

export function DustSweepSummary({
  desktop,
  onDetails,
  onLeave,
}: {
  desktop: boolean;
  onDetails: () => void;
  // The mobile live sheet covers the page's back control; it offers Leave
  // while a submission is unknown (the sweep can neither finish nor stop).
  onLeave?: () => void;
}) {
  const model = useDustSweep();
  const {
    session,
    selecting,
    current,
    selected,
    selectedValueUsd,
    canStart,
    loadStatus,
    assetStatus,
    providerInfo,
  } = model;
  const { state } = session;
  const assetSyncError = selecting && assetStatus === 'error';
  const assetsLoading =
    selecting && (loadStatus === 'loading' || assetStatus === 'refreshing');
  const intl = useIntl();
  const formatFiat = useDustSweepFiatFormatter();
  const { totals, completed, unknown } = getDustSweepPresentation(state);
  const nativeToken = state.snapshot?.nativeToken ?? current?.nativeToken;
  const receiveFormatterOptions = useMemo(
    () => ({ tokenSymbol: nativeToken?.symbol }),
    [nativeToken?.symbol],
  );
  const receiveTokenLoading = assetsLoading && !nativeToken;
  // Before converting, estimate from the selection's market value (as Rabby
  // does) so it always matches the action label; afterwards show what arrived.
  const nativePrice = new BigNumber(nativeToken?.price ?? NaN);
  const hasNativePrice = nativePrice.isFinite() && nativePrice.gt(0);
  let amount = totals.receivedAmount;
  if (selecting)
    amount = hasNativePrice
      ? new BigNumber(selectedValueUsd).div(nativePrice).toFixed()
      : '0';
  const amountUnavailable = selecting
    ? !hasNativePrice
    : totals.receiptUnavailable || unknown;
  // No receive token means no network to sweep on (e.g. a wallet with no
  // assets), so show zero instead of placeholders.
  let receiveAmount: ReactNode = '0.00';
  let receiveValue = formatFiat('0');
  if (nativeToken) {
    receiveAmount = amountUnavailable ? (
      `— ${nativeToken.symbol}`
    ) : (
      <NumberSizeableText
        key={intl.locale}
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={receiveFormatterOptions}
      >
        {amount}
      </NumberSizeableText>
    );
    if (selecting) receiveValue = formatFiat(selectedValueUsd);
    else
      receiveValue =
        amountUnavailable || !hasNativePrice
          ? '—'
          : formatFiat(new BigNumber(amount).times(nativePrice));
  }
  let label = intl.formatMessage(
    { id: ETranslations.button_convert_tokens_estimated_amount },
    {
      count: selected.length,
      amount: formatFiat(selectedValueUsd),
    },
  );
  let onPress: () => void | Promise<void> = () => {
    model.start();
  };
  if (completed) {
    label = intl.formatMessage({ id: ETranslations.global_done });
    // Both layouts go back to token selection for another sweep.
    onPress = model.sweepAgain;
  } else if (unknown) {
    label = intl.formatMessage({ id: ETranslations.global_details });
    onPress = onDetails;
  } else if (state.phase === 'paused') {
    label = intl.formatMessage({ id: ETranslations.global_continue });
    onPress = session.resume;
  } else if (assetSyncError) {
    label = `${intl.formatMessage({ id: ETranslations.global_sync_error })} · ${intl.formatMessage({ id: ETranslations.global_retry })}`;
    onPress = model.retryAssets;
  } else if (!selecting) {
    label = intl.formatMessage({ id: ETranslations.global_pause });
    onPress = session.pause;
  }
  const converting = !selecting && !completed && !unknown;
  const { height: windowHeight } = useWindowDimensions();
  const result = <DustSweepResult state={state} desktop={desktop} />;
  // Desktop is a card; the mobile selection footer sits on the list with a top
  // edge, while the live sheet already has its own.
  let edgeProps = {};
  if (desktop)
    edgeProps = {
      borderWidth: 1,
      borderColor: '$borderSubdued',
      borderRadius: '$5',
      // Same halo as the desktop Swap cards.
      '$platform-web': SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
    };
  else if (selecting)
    edgeProps = { borderTopWidth: 1, borderColor: '$borderSubdued' };
  return (
    <YStack
      testID="dust-sweep-summary"
      // Desktop fills the row so it matches the token list card height.
      flex={desktop ? 1 : undefined}
      // The mobile selection footer keeps a fixed height.
      height={
        !desktop && selecting ? MOBILE_SELECTION_FOOTER_HEIGHT : undefined
      }
      // Mobile shows the sweep in a bottom sheet: capped so the action stays
      // visible on short phones while the live result scrolls inside.
      maxHeight={
        !desktop && !selecting
          ? Math.round(windowHeight * MOBILE_SHEET_MAX_HEIGHT_RATIO)
          : undefined
      }
      flexShrink={0}
      px="$5"
      pt={desktop ? '$5' : '$0'}
      pb={desktop ? '$5' : 33}
      {...edgeProps}
    >
      {/* Once converting, the live result replaces the estimate and grows into
          the completed result in place. */}
      {selecting ? (
        <>
          {desktop ? (
            <SizableText size="$bodyMd" color="$textSubdued" height={20}>
              {intl.formatMessage({
                id: ETranslations.sign_swap_estimate_receive,
              })}
            </SizableText>
          ) : null}
          <XStack height={desktop ? 72 : 60} alignItems="center" gap="$2">
            {receiveTokenLoading ? (
              <Stack testID="dust-sweep-receive-token-loading">
                <Skeleton width="$8" height="$8" radius="round" />
              </Stack>
            ) : (
              <Token
                size="md"
                tokenImageUri={nativeToken?.logoURI}
                networkId={nativeToken?.networkId}
                showNetworkIcon
              />
            )}
            {nativeToken ? (
              <SizableText size="$bodyLgMedium">
                {nativeToken.symbol}
              </SizableText>
            ) : null}
            <YStack flex={1} alignItems="flex-end" height={44}>
              {loadStatus === 'loading' ? (
                <>
                  <Stack height={24} justifyContent="center">
                    <Skeleton width={96} height={16} />
                  </Stack>
                  <Stack height={20} justifyContent="center">
                    <Skeleton width={60} height={12} />
                  </Stack>
                </>
              ) : (
                <>
                  <SizableText
                    testID="dust-sweep-receive-amount"
                    size="$bodyLgMedium"
                    height={24}
                  >
                    {receiveAmount}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued" height={20}>
                    {receiveValue}
                  </SizableText>
                </>
              )}
            </YStack>
          </XStack>
          {desktop ? <Divider /> : null}
          <YStack height={desktop ? 65 : 62} pt={desktop ? 16 : 14} gap="$2">
            <XStack height={20} alignItems="center" gap="$2">
              <Stack flex={1} minWidth={0}>
                <SwapProviderInfoItem
                  testID="dust-sweep-provider"
                  showFeeInfo={false}
                  fromToken={selected[0]}
                  toToken={nativeToken}
                  // The configured provider; quotes happen per token on submit.
                  providerIcon={
                    loadStatus === 'ready' ? (providerInfo?.logo ?? '') : ''
                  }
                  providerName={
                    loadStatus === 'ready'
                      ? (providerInfo?.providerName ?? '')
                      : ''
                  }
                  allowProviderWithoutTokens
                  isLoading={loadStatus === 'loading'}
                  showEmptyPlaceholder
                  valueProps={{
                    numberOfLines: 1,
                    maxWidth: desktop ? 180 : 164,
                    flexShrink: 1,
                  }}
                />
              </Stack>
            </XStack>
            <SwapCommonInfoItem
              containerProps={{ height: 20 }}
              title={intl.formatMessage({
                id: ETranslations.slippage_tolerance_title,
              })}
              questionMarkPopoverProps={{
                mountNativePortalBeforeOpen: true,
                renderTrigger: (
                  <IconButton
                    testID="dust-sweep-slippage-help"
                    icon="InfoCircleOutline"
                    iconSize="$3.5"
                    iconProps={{ color: '$iconSubdued' }}
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.slippage_tolerance_title,
                    })}
                    variant="tertiary"
                    size="small"
                    hotKey
                    width="$3.5"
                    height="$3.5"
                    minHeight="$3.5"
                    borderWidth={0}
                    p={0}
                    m={0}
                  />
                ),
              }}
              questionMarkContent={
                <SizableText p="$4" $gtMd={{ size: '$bodyMd' }}>
                  {intl.formatMessage({
                    id: ETranslations.slippage_tolerance_popover,
                  })}
                </SizableText>
              }
              valueComponent={<DustSweepSlippage />}
            />
          </YStack>
        </>
      ) : null}
      {!selecting && desktop ? result : null}
      {!selecting && !desktop ? (
        <ScrollView
          // Size to the result (web defaults the basis to 0) and shrink only
          // when the panel hits its cap.
          flexGrow={0}
          flexShrink={1}
          flexBasis="auto"
          showsVerticalScrollIndicator={false}
        >
          {result}
        </ScrollView>
      ) : null}
      {desktop ? <Stack flex={1} /> : <Stack height={MOBILE_ACTION_GAP} />}
      <XStack gap="$2.5">
        {unknown && onLeave ? (
          <Button
            testID="dust-sweep-leave"
            flex={1}
            height={DUST_SWEEP_ACTION_HEIGHT}
            minHeight={DUST_SWEEP_ACTION_HEIGHT}
            disabled={session.leaving}
            onPress={onLeave}
          >
            {intl.formatMessage({ id: ETranslations.sweep_leave_dust_sweep })}
          </Button>
        ) : null}
        {/* Paused: Stop gives up the remaining tokens, Continue resumes. */}
        {state.phase === 'paused' && !unknown ? (
          <Button
            testID="dust-sweep-stop"
            flex={1}
            height={DUST_SWEEP_ACTION_HEIGHT}
            minHeight={DUST_SWEEP_ACTION_HEIGHT}
            loading={model.stopping}
            disabled={session.leaving || model.stopping}
            onPress={model.stop}
          >
            {intl.formatMessage({ id: ETranslations.button_stop_conversion })}
          </Button>
        ) : null}
        <Button
          testID="dust-sweep-action"
          flex={1}
          height={DUST_SWEEP_ACTION_HEIGHT}
          minHeight={DUST_SWEEP_ACTION_HEIGHT}
          // Pause stays quiet while tokens convert; every other step is the
          // primary action.
          variant={
            converting && state.phase !== 'paused' ? 'secondary' : 'primary'
          }
          loading={assetsLoading}
          childrenAsText={!assetsLoading}
          accessibilityLabel={
            assetsLoading
              ? intl.formatMessage({ id: ETranslations.global_syncing })
              : undefined
          }
          disabled={
            assetsLoading ||
            session.leaving ||
            model.stopping ||
            state.phase === 'left' ||
            (selecting && loadStatus !== 'ready') ||
            (selecting && !canStart && !assetSyncError)
          }
          onPress={onPress}
        >
          {assetsLoading ? null : label}
        </Button>
      </XStack>
    </YStack>
  );
}
