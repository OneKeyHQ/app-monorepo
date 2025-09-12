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
      { key: 'asset', title: 'Asset', width: 100, align: 'left' },
      { key: 'time', title: 'Time', minWidth: 100, align: 'left', flex: 1 },
      { key: 'type', title: 'Type', minWidth: 100, align: 'left', flex: 1 },
      { key: 'size', title: 'Size', minWidth: 100, align: 'left', flex: 1 },
      {
        key: 'originalSize',
        title: 'Original Size',
        minWidth: 100,
        align: 'left',
        flex: 1,
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
        minWidth: 160,
        flex: 1,
        align: 'left',
      },
      { key: 'TPSL', title: 'TP/SL', minWidth: 140, flex: 1, align: 'center' },
      {
        key: 'cancel',
        title: 'Cancel All',
        minWidth: 100,
        align: 'right',
        flex: 1,
      },
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
        index={_index}
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
