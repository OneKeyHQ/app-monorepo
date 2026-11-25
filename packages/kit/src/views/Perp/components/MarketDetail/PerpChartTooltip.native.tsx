import type { ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { YStack, useTheme } from '@onekeyhq/components';
import { useOverlayPageHostLayout } from '@onekeyhq/kit/src/routes/OverlayPageHostLayoutContext';

import type { ViewInstance } from 'react-native';

const TOOLTIP_ANIMATION = { enter: { type: 'none' } } as const;

type IPoint = { x: number; y: number };

function useChartHostLayout() {
  const hostLayout = useOverlayPageHostLayout();
  const anchorRef = useRef<ViewInstance>(null);
  const [geometry, setGeometry] = useState<{
    origin?: IPoint;
    host?: IPoint & { width: number; height: number };
    height: number;
  }>({ height: 0 });
  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y) => {
      hostLayout?.node?.measureInWindow((hostX, hostY, width, height) => {
        // Both measurements share the same native window, so modal offsets cancel.
        setGeometry((previous) => ({
          ...previous,
          origin: { x: x - hostX, y: y - hostY },
          host: { x: hostX, y: hostY, width, height },
        }));
      });
    });
  }, [hostLayout]);
  const setHeight = useCallback((height: number) => {
    setGeometry((previous) =>
      previous.height === height ? previous : { ...previous, height },
    );
  }, []);
  return {
    ...geometry,
    insets: hostLayout?.insets,
    anchorRef,
    measureAnchor,
    setHeight,
  };
}

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
  const window = useWindowDimensions();
  const { anchorRef, measureAnchor, origin, host, height, setHeight, insets } =
    useChartHostLayout();
  useLayoutEffect(() => {
    measureAnchor();
  }, [measureAnchor, x, y, chartWidth, window.width, window.height]);

  const bounds = host ?? {
    x: 0,
    y: 0,
    width: window.width,
    height: window.height,
  };
  const safeLeft = insets?.left ?? 0;
  const safeTop = insets?.top ?? 0;
  const safeRight = insets?.right ?? 0;
  const safeBottom = insets?.bottom ?? 0;
  const width = Math.min(
    200,
    Math.max(0, chartWidth - 16),
    Math.max(0, bounds.width - safeLeft - safeRight - 16),
  );
  const left = Math.max(
    safeLeft + 8,
    Math.min(
      bounds.width - safeRight - width - 8,
      (origin?.x ?? 0) + x - width / 2,
    ),
  );
  const minTop = safeTop + 8;
  const abovePlot = (origin?.y ?? 0) - height - 12;
  const touchY = (origin?.y ?? 0) + y;
  const aboveTouch = touchY - height - 12;
  let preferredTop = touchY + 12;
  if (abovePlot >= minTop) {
    preferredTop = abovePlot;
  } else if (aboveTouch >= minTop) {
    preferredTop = aboveTouch;
  }
  const top = Math.max(
    minTop,
    Math.min(bounds.height - safeBottom - height - 8, preferredTop),
  );
  const ready =
    !!origin &&
    !!host &&
    !!insets &&
    host.height > 0 &&
    height > 0 &&
    width > 0;

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
        contentSize={{ width: bounds.width, height: bounds.height }}
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
