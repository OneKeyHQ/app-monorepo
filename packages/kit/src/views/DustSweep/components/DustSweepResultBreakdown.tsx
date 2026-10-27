import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { TokenGroup } from '@onekeyhq/kit/src/components/Token/TokenGroup';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EDustSweepItemStatus } from '@onekeyhq/shared/types/swap/dustSweep';

import { getDustSweepTotals } from '../stateMachine';
import { groupDustSweepSkips } from '../utils/skipReasons';

import { getDustSweepItemReasonMessage } from './DustSweepTokenRow';

import type { IDustSweepState } from '../stateMachine';
import type { IDustSweepSkipGroup } from '../utils/skipReasons';

const MAX_PREVIEW_TOKENS = 3;

function DustSweepReasonRow({
  group,
  testID,
}: {
  group: IDustSweepSkipGroup;
  testID: string;
}) {
  const intl = useIntl();
  const overflow = group.tokens.length - MAX_PREVIEW_TOKENS;
  return (
    <XStack
      testID={testID}
      height={20}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        flexShrink={1}
        numberOfLines={1}
      >
        {group.label ?? intl.formatMessage({ id: ETranslations.global_others })}
      </SizableText>
      <XStack alignItems="center" gap="$1.5" flexShrink={0}>
        <TokenGroup
          tokens={group.tokens.map((token) => ({
            tokenImageUri: token.logoURI,
          }))}
          size="xxs"
          maxVisible={MAX_PREVIEW_TOKENS}
          backgroundColor="$bgSubdued"
          showRemainingBadge={false}
        />
        {overflow > 0 ? (
          <SizableText size="$bodySm" color="$textSubdued">
            +{overflow}
          </SizableText>
        ) : null}
      </XStack>
    </XStack>
  );
}

// A count that pops and briefly takes its tone each time it goes up, so every
// settled token is felt while the sweep runs.
function DustSweepBreakdownCount({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: '$textSuccess' | '$textCritical';
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(count);
  const [highlighted, setHighlighted] = useState(false);
  useEffect(() => {
    const increased = count > previous.current;
    previous.current = count;
    if (!increased || reducedMotion) return undefined;
    scale.value = withSequence(
      withTiming(1.25, { duration: 150 }),
      withTiming(1, { duration: 300 }),
    );
    setHighlighted(true);
    const timer = setTimeout(() => setHighlighted(false), 450);
    return () => clearTimeout(timer);
  }, [count, reducedMotion, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={style}>
      <SizableText size="$bodyMdMedium" color={highlighted ? tone : undefined}>
        {label}
      </SizableText>
    </Animated.View>
  );
}

function DustSweepReasonBreakdown({
  state,
  collapsible,
  status,
  count,
}: {
  state: IDustSweepState;
  collapsible: boolean;
  status: EDustSweepItemStatus.Failed | EDustSweepItemStatus.Skipped;
  count: number;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  // Web leaves layout-animated views absolutely positioned (they stop taking
  // space), so these only run natively.
  const animate = platformEnv.isNative && !reducedMotion;
  const reasonEntering = animate ? FadeInDown.duration(300) : undefined;
  const reasonLayout = animate ? LinearTransition.duration(300) : undefined;
  const [open, setOpen] = useState(!collapsible);
  const nativeTokenSymbol = state.snapshot?.nativeToken.symbol;
  const groups = useMemo(
    () =>
      groupDustSweepSkips(
        state.items.filter((item) => item.status === status),
        (item) => getDustSweepItemReasonMessage(intl, item, nativeTokenSymbol),
      ),
    [intl, state.items, nativeTokenSymbol, status],
  );
  const canToggle = collapsible && count > 0;
  const reasonTestID =
    status === EDustSweepItemStatus.Failed
      ? 'dust-sweep-failure'
      : 'dust-sweep-skip';
  return (
    <YStack gap="$3">
      <XStack
        testID={`dust-sweep-result-${status}`}
        height={20}
        alignItems="center"
        justifyContent="space-between"
        {...(canToggle
          ? {
              role: 'button',
              cursor: 'pointer',
              hitSlop: 8,
              accessibilityState: { expanded: open },
              onPress: () => setOpen((value) => !value),
            }
          : {})}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id:
              status === EDustSweepItemStatus.Failed
                ? ETranslations.global_failed
                : ETranslations.label_skipped,
          })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          <DustSweepBreakdownCount
            count={count}
            label={intl.formatMessage(
              { id: ETranslations.dust_sweep_token_count__desc },
              { count },
            )}
            tone="$textCritical"
          />
          {canToggle ? (
            <Icon
              name={open ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
              size="$5"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      </XStack>
      {open && groups.length ? (
        <Animated.View layout={reasonLayout}>
          <Stack
            testID={`${reasonTestID}-reasons`}
            bg="$bgSubdued"
            borderRadius="$3"
            p="$3"
            gap="$2"
          >
            {groups.map((group) => (
              <Animated.View
                key={group.label ?? 'others'}
                entering={reasonEntering}
              >
                <DustSweepReasonRow
                  group={group}
                  testID={`${reasonTestID}-reason`}
                />
              </Animated.View>
            ))}
          </Stack>
        </Animated.View>
      ) : null}
    </YStack>
  );
}

// Each unsuccessful outcome owns its count and reasons. Mobile expands them
// independently so a long error list does not crowd the result sheet.
export function DustSweepResultBreakdown({
  state,
  collapsible,
}: {
  state: IDustSweepState;
  collapsible: boolean;
}) {
  const intl = useIntl();
  const totals = getDustSweepTotals(state.items);
  return (
    <YStack testID="dust-sweep-result-breakdown" width="100%" gap="$3">
      <XStack height={20} alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.label_converted })}
        </SizableText>
        <DustSweepBreakdownCount
          count={totals.successCount}
          label={intl.formatMessage(
            { id: ETranslations.dust_sweep_token_count__desc },
            { count: totals.successCount },
          )}
          tone="$textSuccess"
        />
      </XStack>
      <DustSweepReasonBreakdown
        state={state}
        collapsible={collapsible}
        status={EDustSweepItemStatus.Failed}
        count={totals.failedCount}
      />
      <DustSweepReasonBreakdown
        state={state}
        collapsible={collapsible}
        status={EDustSweepItemStatus.Skipped}
        count={totals.skippedCount}
      />
    </YStack>
  );
}
