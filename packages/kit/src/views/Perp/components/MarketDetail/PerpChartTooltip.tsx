import type { ReactNode } from 'react';

import { Tooltip, YStack } from '@onekeyhq/components';

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
  const width = Math.min(200, Math.max(0, chartWidth - 16));
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
