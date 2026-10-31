import { useMemo, useRef } from 'react';

import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Haptics, ImpactFeedbackStyle } from '@onekeyhq/components';

import type { IPtChartScrubAreaProps } from './PtChartScrubArea.types';

// The chart sits in the Info tab's pager inside the page scroll. Holding
// first leaves a quick horizontal swipe to the pager and a vertical drag to
// the scroll; the gesture fails as soon as the finger moves during the hold.
const HOLD_TO_SCRUB_MS = 200;

export function PtChartScrubArea({
  width,
  height,
  onScrub,
  onScrubEnd,
}: IPtChartScrubAreaProps) {
  // The gesture is built once so a re-render mid-drag doesn't reset it.
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;
  const onScrubEndRef = useRef(onScrubEnd);
  onScrubEndRef.current = onScrubEnd;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(HOLD_TO_SCRUB_MS)
        .onStart((event) => {
          Haptics.impact(ImpactFeedbackStyle.Light);
          onScrubRef.current(event.x);
        })
        .onUpdate((event) => {
          onScrubRef.current(event.x);
        })
        .onFinalize(() => {
          onScrubEndRef.current();
        }),
    [],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left: 0, top: 0, width, height }} />
    </GestureDetector>
  );
}
