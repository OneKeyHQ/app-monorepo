import type { ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { YStack, useSafeAreaInsets, useTheme } from '@onekeyhq/components';

import type { ViewInstance } from 'react-native';

const TOOLTIP_ANIMATION = { enter: { type: 'none' } } as const;

export function PerpChartTooltip({
  children,
  testID,
  chartWidth,
  x,
  y,
}: {
  children: ReactNode;
  testID: string;
  chartWidth: number;
  chartHeight: number;
  x: number;
  y: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const anchorRef = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number }>();
  const [offset, setOffset] = useState<{ x: number; y: number }>();
  const [offsetRequest, setOffsetRequest] = useState(0);
  const [height, setHeight] = useState(0);
  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((anchorX, anchorY) => {
      setAnchor({ x: anchorX, y: anchorY });
      setOffsetRequest((request) => request + 1);
    });
  }, []);
  useLayoutEffect(() => {
    measureAnchor();
  }, [measureAnchor, x, y, chartWidth, window.width, window.height]);

  const width = Math.min(
    200,
    Math.max(0, chartWidth - 16),
    Math.max(0, window.width - insets.left - insets.right - 16),
  );
  const origin =
    anchor && offset
      ? { x: anchor.x + offset.x, y: anchor.y + offset.y }
      : undefined;
  const left = Math.max(
    insets.left + 8,
    Math.min(
      window.width - insets.right - width - 8,
      (origin?.x ?? 0) + x - width / 2,
    ),
  );
  const top = Math.max(
    insets.top + 8,
    Math.min(
      window.height - insets.bottom - height - 8,
      (origin?.y ?? 0) - height - 12,
    ),
  );
  const ready = !!origin && height > 0 && width > 0;

  return (
    <>
      <View
        ref={anchorRef}
        collapsable={false}
        pointerEvents="none"
        onLayout={measureAnchor}
        style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1 }}
      />
      <OverlayView
        visible={ready}
        keepContentMounted
        scope="page"
        level="modal"
        presentation="fullscreen"
        blocking={false}
        backdrop={false}
        dismissOnBackPress={false}
        animation={TOOLTIP_ANIMATION}
        windowOffsetRequest={offsetRequest}
        onWindowOffset={setOffset}
      >
        <YStack
          position="absolute"
          left={left}
          top={top}
          pointerEvents="none"
          opacity={ready ? 1 : 0}
        >
          <YStack
            testID={testID}
            role="tooltip"
            width={width}
            px="$3"
            py="$3"
            gap="$2"
            bg="$bgInverse"
            borderRadius="$2"
            pointerEvents="none"
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
          >
            {children}
          </YStack>
          {origin && top + height < origin.y ? (
            <YStack
              position="absolute"
              left={Math.max(8, Math.min(width - 20, origin.x + x - left - 6))}
              bottom={-6}
              pointerEvents="none"
            >
              <Svg width={12} height={6}>
                <Path d="M0 0H12L6 6Z" fill={theme.bgInverse.val} />
              </Svg>
            </YStack>
          ) : null}
        </YStack>
      </OverlayView>
    </>
  );
}
