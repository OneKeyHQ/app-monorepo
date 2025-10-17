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
  length?: number;
}

export function DashText({
  children,
  dashLength = 3,
  dashGap = 2,
  dashThickness = 1,
  dashColor = '$textSubdued',
  length = 80,
  ...textProps
}: IDashTextProps) {
  const [textWidth, setTextWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <YStack alignItems="flex-start">
      <YStack onLayout={handleLayout}>
        <SizableText {...textProps} paddingBottom="$0.2">
          {children}
        </SizableText>
      </YStack>
      <XStack
        gap={dashGap}
        overflow="hidden"
        flexWrap="nowrap"
        width={textWidth}
      >
        {Array.from({ length }, (_, i) => (
          <YStack
            key={i}
            width={dashLength}
            height={dashThickness}
            bg={dashColor}
            flexShrink={0}
          />
        ))}
      </XStack>
    </YStack>
  );
}
