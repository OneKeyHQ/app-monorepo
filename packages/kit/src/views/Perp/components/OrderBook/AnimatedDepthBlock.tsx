import { useMemo } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  prices,
  sizes,
  priceColor,
  sizeColor,
  priceFontSize,
  sizeFontSize,
  textInset,
  onRowPress,
  placeholderText,
  placeholderRows,
}: IDepthBarColumnProps) {
  const barHeight = rowHeight - 2 * barInset;
  // Empty state: draw `--` placeholder rows here (no RN overlay), matching the
  // native variant which draws the placeholder itself.
  if (percents.length === 0 && placeholderText && (placeholderRows ?? 0) > 0) {
    return (
      <>
        {Array.from({ length: placeholderRows ?? 0 }).map((_, index) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            style={{
              height: rowHeight,
              marginTop: rowMarginTop,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: textInset ?? 0,
            }}
          >
            <Text style={{ color: priceColor, fontSize: priceFontSize }}>
              {placeholderText}
            </Text>
            <Text style={{ color: sizeColor, fontSize: sizeFontSize }}>
              {placeholderText}
            </Text>
          </View>
        ))}
      </>
    );
  }
  return (
    <>
      {percents.map((percent, index) => {
        const priceText = prices?.[index] ?? '';
        const sizeText = sizes?.[index] ?? '';
        const shouldRenderText = priceText.length > 0 || sizeText.length > 0;
        return (
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
            {shouldRenderText ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: textInset ?? 0,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: priceColor,
                    fontSize: priceFontSize,
                    flexShrink: 1,
                    paddingRight: 4,
                  }}
                >
                  {priceText}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: sizeColor,
                    fontSize: sizeFontSize,
                    flexShrink: 1,
                    textAlign: 'right',
                  }}
                >
                  {sizeText}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
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
