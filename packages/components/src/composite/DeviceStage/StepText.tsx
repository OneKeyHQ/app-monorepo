import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { easeInFn, easeOutFn } from '../../content/deviceScene';
import { SizableText } from '../../primitives';
import { SWAP_IN_MS, SWAP_OUT_MS } from '../MorphOverlay';

/**
 * The stage's words, one voice for every step: title and subtitle
 * swapped as one block — the outgoing pair lifts out and fades, then the
 * incoming pair rises in from below, strictly in that order, so the two
 * never share the stage. The swap starts the moment the step changes:
 * the words wait for nothing else. With `animated` off (the surface is
 * closed, or motion is reduced) they snap, so a reopened stage never
 * replays a stale swap; a fresh mount shows its target directly —
 * arrivals are carried by their presenter's own fade.
 *
 * The clock IS the container's crossing clock (one grammar): words
 * swapping in place and arrangements crossing run the same two phases
 * with the same easings, so anything queued on either beat agrees.
 */

export const TEXT_OUT_MS = SWAP_OUT_MS;
export const TEXT_IN_MS = SWAP_IN_MS;
const TEXT_OUT_RISE = 14;
const TEXT_IN_DROP = 18;

// The design's title-and-description block: 4pt between the two lines
// and a fixed 16pt under the block — whatever follows (a keypad, a form,
// a payload card, a button) sits straight against it, and a block that
// ends the column leaves that same air above the card's chin.
const styles = StyleSheet.create({
  textBlock: {
    gap: 4,
    paddingBottom: 16,
  },
});

export function StepText({
  title,
  sub,
  animated,
  subColor = '$textSubdued',
  subSlot,
}: {
  title: string;
  sub: string;
  animated: boolean;
  /** The sub line's color — subdued by default; the NOTE beat wears
   * critical on the same metrics. */
  subColor?: ComponentProps<typeof SizableText>['color'];
  /** Interactive content in the sub line's seat (same 4pt gap under the
   * title). Rendered live, outside the swap's shown-text cache: a slot
   * change never replays the title, it just appears in place. */
  subSlot?: ReactNode;
}) {
  const [shown, setShown] = useState({ title, sub });
  const targetRef = useRef({ title, sub });
  targetRef.current = { title, sub };
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);
  const enter = useCallback(() => {
    setShown(targetRef.current);
    shift.value = TEXT_IN_DROP;
    opacity.value = withTiming(1, { duration: TEXT_IN_MS, easing: easeOutFn });
    shift.value = withTiming(0, { duration: TEXT_IN_MS, easing: easeOutFn });
  }, [opacity, shift]);
  useEffect(() => {
    if (shown.title === title && shown.sub === sub) return;
    if (!animated) {
      cancelAnimation(opacity);
      cancelAnimation(shift);
      opacity.value = 1;
      shift.value = 0;
      setShown({ title, sub });
      return;
    }
    cancelAnimation(opacity);
    cancelAnimation(shift);
    shift.value = withTiming(-TEXT_OUT_RISE, {
      duration: TEXT_OUT_MS,
      easing: easeInFn,
    });
    opacity.value = withTiming(
      0,
      { duration: TEXT_OUT_MS, easing: easeInFn },
      (finished) => {
        if (finished) runOnJS(enter)();
      },
    );
  }, [animated, enter, opacity, shift, shown, sub, title]);
  const motionStyle = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
      transform: [{ translateY: shift.value }],
    }),
    [opacity, shift],
  );
  const style = useMemo(() => [styles.textBlock, motionStyle], [motionStyle]);
  return (
    <Animated.View style={style}>
      <SizableText size="$heading2xl">{shown.title}</SizableText>
      {shown.sub ? (
        <SizableText size="$bodyMd" color={subColor}>
          {shown.sub}
        </SizableText>
      ) : null}
      {subSlot}
    </Animated.View>
  );
}
