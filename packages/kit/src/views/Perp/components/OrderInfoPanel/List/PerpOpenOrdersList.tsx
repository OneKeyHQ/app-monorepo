import { useMemo } from 'react';

import { usePerpOrders } from '../../../hooks/usePerpOrderInfoPanel';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { FrontendOrder } from '@nktkas/hyperliquid';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
}

function PerpOpenOrdersList({ isMobile }: IPerpOpenOrdersListProps) {
  const orders = usePerpOrders();
  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      { key: 'asset', title: 'Asset', width: 80, align: 'center' },
      { key: 'time', title: 'Time', width: 100, align: 'left' },
      { key: 'type', title: 'Type', width: 80, align: 'left' },
      { key: 'size', title: 'Size', width: 80, align: 'left' },
      {
        key: 'originalSize',
        title: 'Original Size',
        width: 100,
        align: 'left',
      },
      { key: 'value', title: 'Value', minWidth: 100, flex: 1, align: 'left' },
      {
        key: 'executePrice',
        title: 'Execute Price',
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'triggerCondition',
        title: 'Trigger Condition',
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      { key: 'TPSL', title: 'TP/SL', minWidth: 100, flex: 1, align: 'left' },
      { key: 'cancel', title: 'Cancel All', width: 100, align: 'right' },
    ],
    [],
  );
  const handleCancelAll = () => {
    console.log('handleCancelAll');
  };
  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );
  const renderOrderRow = (item: FrontendOrder, _index: number) => {
    return (
      <OpenOrdersRow
        order={item}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        handleCancelAll={handleCancelAll}
      />
    );
  };

  return (
    <CommonTableListView
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={orders}
      isMobile={isMobile}
      renderRow={renderOrderRow}
      emptyMessage="No open orders"
      emptySubMessage="Your orders will appear here after opening trades"
    />
  );
}

export { PerpOpenOrdersList };
