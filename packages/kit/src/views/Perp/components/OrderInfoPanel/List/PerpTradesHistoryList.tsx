import { useMemo } from 'react';

import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpTradesHistory } from '../../../hooks/usePerpOrderInfoPanel';
import { TradesHistoryRow } from '../Components/TradesHistoryRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

// Column configuration for CommonTableListView
function PerpTradesHistoryList() {
  const { trades } = usePerpTradesHistory();
  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      { key: 'asset', title: 'Asset', width: 80, align: 'center' },
      { key: 'time', title: 'Time', width: 100, align: 'left' },
      { key: 'direction', title: 'Direction', width: 100, align: 'left' },
      { key: 'price', title: 'Price', minWidth: 100, flex: 1, align: 'left' },
      {
        key: 'size',
        title: 'Position Size',
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'value',
        title: 'Trade Value',
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      { key: 'fee', title: 'Fee', minWidth: 100, flex: 1, align: 'left' },
      { key: 'closePnl', title: 'Close PnL', width: 100, align: 'right' },
    ],
    [],
  );
  const renderTradesHistoryRow = (item: IFill, _index: number) => {
    return (
      <TradesHistoryRow
        fill={item}
        cellMinWidth={780}
        columnConfigs={columnsConfig}
      />
    );
  };

  return (
    <CommonTableListView
      columns={columnsConfig}
      data={trades}
      renderRow={renderTradesHistoryRow}
      emptyMessage="No open positions"
      emptySubMessage="Your positions will appear here after opening trades"
    />
  );
}

export { PerpTradesHistoryList };
