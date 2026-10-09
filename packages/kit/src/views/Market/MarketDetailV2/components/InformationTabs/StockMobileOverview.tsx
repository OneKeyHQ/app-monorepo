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
  return (
    <YStack>
      <YStack px={STOCK_DETAIL_HORIZONTAL_GUTTER} pt="$5" pb="$2">
        <StockOverviewGrid columns={2} />
      </YStack>
      <StockEventsSection />
      <StockAnalystRatings />
      <StockNewsSection />
      <StockAbout columns={2} />
    </YStack>
  );
}
