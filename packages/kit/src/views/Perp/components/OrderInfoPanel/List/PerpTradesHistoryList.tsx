import { useMemo } from 'react';

import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpTradesHistory } from '../../../hooks/usePerpOrderInfoPanel';
import { TradesHistoryRow } from '../Components/TradesHistoryRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpTradesHistoryListProps {
  isMobile?: boolean;
}

function PerpTradesHistoryList({ isMobile }: IPerpTradesHistoryListProps) {
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
  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );
  const renderTradesHistoryRow = (item: IFill, _index: number) => {
    return (
      <TradesHistoryRow
        fill={item}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
      />
    );
  };

  return (
    <CommonTableListView
      columns={columnsConfig}
      data={trades}
      isMobile={isMobile}
      minTableWidth={totalMinWidth}
      renderRow={renderTradesHistoryRow}
      emptyMessage="No open positions"
      emptySubMessage="Your positions will appear here after opening trades"
    />
  );
}

export { PerpTradesHistoryList };
