import {
  StockMarketStatusAlert,
  getStockMarketClosedDescription,
  resolveStockMarketStatusCase,
} from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';

import { SwapTestIDs } from '../../testIDs';

import type { ISwapPairStockMarketStatus } from '../../utils/usMarketStatusUtils';

export function SwapPairStockMarketStatusAlert({
  status,
}: {
  status?: ISwapPairStockMarketStatus;
}) {
  const { navigateToPerps } = usePerpsNavigation(EPerpPageEnterSource.Trade);
  const closedStock = status?.closedStock;
  if (!closedStock) {
    return null;
  }

  const hlTicker = closedStock.perpsInfo?.hlTicker;
  const closedTimeText = getStockMarketClosedDescription(
    closedStock.stock.description,
  );
  const statusCase = resolveStockMarketStatusCase({
    isOpen: false,
    hasOpenTime: Boolean(closedTimeText),
    hasPerps: Boolean(hlTicker),
  });

  return (
    <StockMarketStatusAlert
      testID={SwapTestIDs.stockTradeStatusAlert}
      statusCase={statusCase}
      timeText={closedTimeText}
      onTradePerps={hlTicker ? () => navigateToPerps(hlTicker) : undefined}
    />
  );
}
