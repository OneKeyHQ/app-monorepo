import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpOrders } from '../../../hooks/usePerpOrderInfoPanel';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

// Column configuration for CommonTableListView
const COLUMNS: IColumnConfig[] = [
  { key: 'side', title: '', width: 10 },
  { key: 'coin', title: 'Coin', width: 140 },
  { key: 'limitPrice', title: 'Limit Price', width: 120 },
  { key: 'size', title: 'Size', width: 100 },
  { key: 'time', title: 'Time', width: 100 },
  { key: 'type', title: 'Type', width: 140 },
  { key: 'tif', title: 'TIF', width: 100 },
  { key: 'actions', title: 'Actions', width: 140 },
];

function PerpOpenOrdersList() {
  const orders = usePerpOrders();
  console.log('orders', orders);

  const renderOrderRow = (
    item: IWsWebData2['openOrders'][number],
    _index: number,
  ) => {
    const oid = item.oid;
    const cloid = item.cloid;
    return (
      <OpenOrdersRow key={`${oid}-${cloid?.toString() ?? ''}`} order={item} />
    );
  };

  return (
    <CommonTableListView
      columns={COLUMNS}
      data={orders}
      renderRow={renderOrderRow}
      emptyMessage="No open orders"
      emptySubMessage="Your orders will appear here after opening trades"
    />
  );
}

export { PerpOpenOrdersList };
