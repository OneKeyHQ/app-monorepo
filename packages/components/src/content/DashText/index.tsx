import { useCallback, useState } from 'react';

import { SizableText, XStack, YStack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { LayoutChangeEvent } from 'react-native';

export interface IDashTextProps extends ISizableTextProps {
  dashLength?: number;
  dashGap?: number;
  dashColor?: string;
  dashThickness?: number;
  children: string;
}

export function DashText({
  children,
  dashLength = 3,
  dashGap = 2,
  dashThickness = 1,
  dashColor = '$textSubdued',
  ...textProps
}: IDashTextProps) {
  const [textWidth, setTextWidth] = useState(0);

  const calculateDashCount = useCallback(
    (width: number) => {
      if (width <= 0) return 0;
      const totalDashWidth = dashLength + dashGap;
      return Math.floor((width + dashGap) / totalDashWidth);
    },
    [dashLength, dashGap],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  }, []);

  const dashCount = calculateDashCount(textWidth);

  return (
    <YStack alignItems="flex-start">
      <YStack onLayout={handleLayout}>
        <SizableText {...textProps} paddingBottom="$0.2">
          {children}
        </SizableText>
      </YStack>
      {textWidth > 0 && dashCount > 0 ? (
        <XStack gap={dashGap}>
          {Array.from({ length: dashCount }, (_, i) => (
            <YStack
              key={i}
              width={dashLength}
              height={dashThickness}
              bg={dashColor}
            />
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}
