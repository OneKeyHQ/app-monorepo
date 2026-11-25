import type { ReactNode } from 'react';

import Svg, { Path } from 'react-native-svg';

import { Tooltip, YStack, useTheme } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function PerpChartTooltip({
  children,
  testID,
  chartWidth,
  chartHeight,
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
  const width = Math.min(200, Math.max(0, chartWidth - 16));
  const left = Math.max(8, Math.min(chartWidth - width - 8, x - width / 2));
  if (width <= 0) return null;

  const content = (
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
    >
      {children}
    </YStack>
  );

  if (!platformEnv.isNative) {
    return (
      <Tooltip
        open
        placement="top"
        offset={12}
        triggerAsChild
        renderTrigger={
          <YStack
            position="absolute"
            left={x}
            top={y}
            width={1}
            height={1}
            pointerEvents="none"
          />
        }
        contentProps={{ p: 0, outlineWidth: 0, bg: 'transparent' }}
        renderContent={content}
      />
    );
  }

  return (
    <YStack
      position="absolute"
      zIndex={100}
      left={left}
      bottom={chartHeight + 12}
      elevation={8}
      borderRadius="$2"
      pointerEvents="none"
    >
      {content}
      <YStack
        position="absolute"
        left={Math.max(8, Math.min(width - 20, x - left - 6))}
        bottom={-6}
        pointerEvents="none"
      >
        <Svg width={12} height={6}>
          <Path d="M0 0H12L6 6Z" fill={theme.bgInverse.val} />
        </Svg>
      </YStack>
    </YStack>
  );
}
