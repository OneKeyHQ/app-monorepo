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
      { key: 'asset', title: 'Asset', width: 100, align: 'left' },
      { key: 'time', title: 'Time', minWidth: 100, flex: 1, align: 'left' },
      {
        key: 'direction',
        title: 'Direction',
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      { key: 'price', title: 'Price', minWidth: 100, flex: 1, align: 'left' },
      {
        key: 'size',
        title: 'Position Size',
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'value',
        title: 'Trade Value',
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      { key: 'fee', title: 'Fee', minWidth: 100, flex: 1, align: 'left' },
      {
        key: 'closePnl',
        title: 'Close PnL',
        minWidth: 100,
        flex: 1,
        align: 'right',
      },
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
        index={_index}
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
