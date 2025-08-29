import React, { memo } from 'react';

import {
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

function PerpChartsSection() {
  return (
    <YStack flex={1} bg="$bg">
      {/* Charts Header - Placeholder for chart controls */}
      <XStack
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        p="$4"
        alignItems="center"
        justifyContent="space-between"
      >
        <SizableText size="$bodyLg" fontWeight="600">
          Chart
        </SizableText>
        <XStack alignItems="center" space="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            TradingView integration coming soon
          </SizableText>
        </XStack>
      </XStack>

      {/* Chart Content - Placeholder */}
      <YStack 
        flex={1} 
        justifyContent="center" 
        alignItems="center" 
        p="$8"
        space="$4"
      >
        <Icon name="ChartLineOutline" size="$12" color="$iconSubdued" />
        <YStack alignItems="center" space="$2">
          <SizableText size="$headingSm" color="$textSubdued">
            Chart Coming Soon
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" textAlign="center" maxWidth={300}>
            TradingView integration will provide advanced charting with technical analysis tools
          </SizableText>
        </YStack>
      </YStack>
    </YStack>
  );
}

const PerpChartsSectionMemo = memo(PerpChartsSection);
export { PerpChartsSectionMemo as PerpChartsSection };