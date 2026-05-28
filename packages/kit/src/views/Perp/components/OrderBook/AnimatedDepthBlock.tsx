import { useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS,
  ORDER_BOOK_SIDE_RATIO_TRANSITION_MS,
  ORDER_BOOK_TRANSITION_EASING,
  normalizeDepthWidth,
} from './AnimatedDepthBlock.shared';

import type {
  IDepthBarProps,
  ISideRatioSegmentsProps,
} from './AnimatedDepthBlock.shared';
import type { ViewStyle } from 'react-native';

// Web/desktop/extension build only. The native variant lives in
// `AnimatedDepthBlock.native.tsx` and is selected automatically by the Metro
// resolver. On web we replace reanimated's JS rAF easing loop with native CSS
// transitions so depth-bar updates stay on the compositor thread.
const DEFAULT_ROW_HEIGHT = 24;

const DEPTH_BAR_TRANSITION = `transform ${ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS}ms ${ORDER_BOOK_TRANSITION_EASING}`;
const SIDE_RATIO_TRANSITION = `flex-grow ${ORDER_BOOK_SIDE_RATIO_TRANSITION_MS}ms ${ORDER_BOOK_TRANSITION_EASING}`;

type IWebViewStyle = ViewStyle & {
  transition?: string;
  transformOrigin?: string;
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  block: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});

export function DepthBar({
  color,
  width,
  left,
  right,
  height,
  origin = 'left',
}: IDepthBarProps) {
  const reducedMotion = useReducedMotion();
  const scale = useMemo(() => normalizeDepthWidth(width) / 100, [width]);
  const blockStyle: IWebViewStyle = {
    backgroundColor: color,
    transform: [{ scaleX: scale }] as ViewStyle['transform'],
    transformOrigin: origin === 'right' ? 'right center' : 'left center',
    transition: reducedMotion ? 'none' : DEPTH_BAR_TRANSITION,
  };
  return (
    <View
      style={[
        styles.container,
        {
          height: height ?? DEFAULT_ROW_HEIGHT,
          right,
          left,
        },
      ]}
    >
      <View style={[styles.block, blockStyle]} />
    </View>
  );
}

export function SideRatioSegments({
  bidPercentage,
  askPercentage,
  longColor,
  shortColor,
  segmentStyle,
  startSegmentStyle,
  endSegmentStyle,
}: ISideRatioSegmentsProps) {
  const reducedMotion = useReducedMotion();
  const transition: string = reducedMotion ? 'none' : SIDE_RATIO_TRANSITION;
  const bid = Math.max(bidPercentage, 1);
  const ask = Math.max(askPercentage, 1);
  return (
    <>
      <View
        style={[
          segmentStyle,
          startSegmentStyle,
          {
            backgroundColor: longColor,
            flexGrow: bid,
            flexShrink: 0,
            flexBasis: 0,
            transition,
          } as IWebViewStyle,
        ]}
      />
      <View
        style={[
          segmentStyle,
          endSegmentStyle,
          {
            backgroundColor: shortColor,
            flexGrow: ask,
            flexShrink: 0,
            flexBasis: 0,
            transition,
          } as IWebViewStyle,
        ]}
      />
    </>
  );
}
