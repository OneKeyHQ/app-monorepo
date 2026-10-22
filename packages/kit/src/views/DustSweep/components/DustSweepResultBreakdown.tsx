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

import { getDustSweepTotals } from '../stateMachine';
import { groupDustSweepSkips } from '../utils/skipReasons';

import { getDustSweepItemReasonMessage } from './DustSweepTokenRow';

import type { IDustSweepState } from '../stateMachine';
import type { IDustSweepSkipGroup } from '../utils/skipReasons';

const MAX_PREVIEW_TOKENS = 3;

function DustSweepSkipReasonRow({ group }: { group: IDustSweepSkipGroup }) {
  const intl = useIntl();
  const overflow = group.tokens.length - MAX_PREVIEW_TOKENS;
  return (
    <XStack
      testID="dust-sweep-skip-reason"
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

// Converted / Skipped counts with the reasons tokens were not converted.
// Desktop always shows the reasons; mobile keeps them behind the Skipped row so
// many reasons never crowd a small screen.
export function DustSweepResultBreakdown({
  state,
  collapsible,
}: {
  state: IDustSweepState;
  collapsible: boolean;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  // Web leaves layout-animated views absolutely positioned (they stop taking
  // space), so these only run natively.
  const animate = platformEnv.isNative && !reducedMotion;
  const reasonEntering = animate ? FadeInDown.duration(300) : undefined;
  const reasonLayout = animate ? LinearTransition.duration(300) : undefined;
  const [open, setOpen] = useState(!collapsible);
  const totals = getDustSweepTotals(state.items);
  const { notConvertedCount } = totals;
  const nativeTokenSymbol = state.snapshot?.nativeToken.symbol;
  const groups = useMemo(
    () =>
      groupDustSweepSkips(state.items, (item) =>
        getDustSweepItemReasonMessage(intl, item, nativeTokenSymbol),
      ),
    [intl, state.items, nativeTokenSymbol],
  );
  const canToggle = collapsible && notConvertedCount > 0;
  const countLabel = (count: number) =>
    intl.formatMessage(
      { id: ETranslations.dust_sweep_token_count__desc },
      { count },
    );
  return (
    <YStack testID="dust-sweep-result-breakdown" width="100%" gap="$3">
      <XStack height={20} alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.label_converted })}
        </SizableText>
        <DustSweepBreakdownCount
          count={totals.successCount}
          label={countLabel(totals.successCount)}
          tone="$textSuccess"
        />
      </XStack>
      <XStack
        testID="dust-sweep-result-skipped"
        height={20}
        alignItems="center"
        justifyContent="space-between"
        {...(canToggle
          ? {
              role: 'button',
              cursor: 'pointer',
              hitSlop: 8,
              onPress: () => setOpen((value) => !value),
            }
          : {})}
      >
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.label_skipped })}
        </SizableText>
        <XStack alignItems="center" gap="$1">
          <DustSweepBreakdownCount
            count={notConvertedCount}
            label={countLabel(notConvertedCount)}
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
      {/* Reasons appear as tokens are skipped during the sweep; the box grows
          with each new reason. */}
      {open && groups.length ? (
        <Animated.View layout={reasonLayout}>
          <Stack
            testID="dust-sweep-skip-reasons"
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
                <DustSweepSkipReasonRow group={group} />
              </Animated.View>
            ))}
          </Stack>
        </Animated.View>
      ) : null}
    </YStack>
  );
}
