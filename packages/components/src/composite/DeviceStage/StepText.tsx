import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

/**
 * The stage's words, shared by both engines so the two surfaces speak
 * with one voice: title and subtitle swapped as one block — the outgoing
 * pair lifts out and fades, then the incoming pair rises in from below,
 * strictly in that order, so the two never share the stage. The swap
 * starts the moment the step changes: the words wait for nothing else.
 * With `animated` off (the surface is closed, or motion is reduced) they
 * snap, so a reopened stage never replays a stale swap; a fresh mount
 * shows its target directly — arrivals are carried by their presenter's
 * own fade.
 */

export const TEXT_OUT_MS = 200;
export const TEXT_IN_MS = 280;
const TEXT_OUT_RISE = 14;
const TEXT_IN_DROP = 18;

const styles = StyleSheet.create({
  textBlock: {
    gap: 6,
  },
});

export function StepText({
  title,
  sub,
  animated,
}: {
  title: string;
  sub: string;
  animated: boolean;
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
        <SizableText fontSize={15} lineHeight={21} color="$textSubdued">
          {shown.sub}
        </SizableText>
      ) : null}
    </Animated.View>
  );
}
