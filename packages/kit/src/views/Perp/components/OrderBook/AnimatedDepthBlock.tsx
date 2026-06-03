import { useMemo } from 'react';

import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  ORDER_BOOK_DEPTH_WIDTH_TRANSITION_MS,
  ORDER_BOOK_SIDE_RATIO_TRANSITION_MS,
  ORDER_BOOK_TRANSITION_EASING,
  normalizeDepthWidth,
} from './AnimatedDepthBlock.shared';

import type {
  IDepthBarColumnProps,
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
  animated = true,
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
    transition: !animated || reducedMotion ? 'none' : DEPTH_BAR_TRANSITION,
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

/**
 * Web/desktop variant of the per-side depth column. Renders one CSS `DepthBar`
 * per row so the visual output matches the legacy per-row implementation. The
 * native variant collapses these into a single `PerpDepthBarsView`; `epoch` is
 * only meaningful there (snap-without-animate), so it is ignored here.
 */
export function DepthBarColumn({
  animated = true,
  percents,
  rowHeight,
  rowMarginTop,
  barInset,
  color,
  origin = 'left',
  onRowPress,
}: IDepthBarColumnProps) {
  const barHeight = rowHeight - 2 * barInset;
  return (
    <>
      {percents.map((percent, index) => (
        <Pressable
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          disabled={!onRowPress}
          onPress={() => onRowPress?.(index)}
          style={{
            cursor: onRowPress ? 'pointer' : undefined,
            height: rowHeight,
            marginTop: rowMarginTop,
            position: 'relative',
          }}
        >
          <DepthBar
            animated={animated}
            color={color}
            origin={origin}
            width={`${percent}%`}
            height={barHeight}
          />
        </Pressable>
      ))}
    </>
  );
}

export function SideRatioSegments({
  animated = true,
  bidPercentage,
  askPercentage,
  longColor,
  shortColor,
  segmentStyle,
  startSegmentStyle,
  endSegmentStyle,
}: ISideRatioSegmentsProps) {
  const reducedMotion = useReducedMotion();
  const transition: string =
    !animated || reducedMotion ? 'none' : SIDE_RATIO_TRANSITION;
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
