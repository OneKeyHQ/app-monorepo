import { useState } from 'react';

import { useWindowDimensions } from 'react-native';

import { YStack } from '@onekeyhq/components';

import { StockEventsSection } from '../../layouts/components/StockEventsSection';
import { StockNewsSection } from '../../layouts/components/StockNewsSection';
import {
  StockAbout,
  StockAnalystRatings,
  StockOverviewGrid,
} from '../../layouts/StockDesktopLayout';
import { STOCK_DETAIL_HORIZONTAL_GUTTER } from '../../layouts/stockDesktopLayoutConstants';

export function StockMobileOverview() {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number>();
  // The loaded ratings row also reserves 8px of right padding.
  const gaugeWidth = Math.max(
    1,
    (containerWidth ?? windowWidth) - STOCK_DETAIL_HORIZONTAL_GUTTER * 2 - 8,
  );

  return (
    <YStack
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <YStack px={STOCK_DETAIL_HORIZONTAL_GUTTER} pt="$5" pb="$2">
        <StockOverviewGrid columns={2} />
      </YStack>
      <StockEventsSection />
      <StockAnalystRatings gaugeWidth={gaugeWidth} />
      <StockNewsSection />
      <StockAbout columns={2} />
    </YStack>
  );
}
