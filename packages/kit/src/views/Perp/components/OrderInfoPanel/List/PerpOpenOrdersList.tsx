import { useCallback, useMemo } from 'react';

import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useTokenList } from '../../../hooks';
import { usePerpOrders } from '../../../hooks/usePerpOrderInfoPanel';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { FrontendOrder } from '@nktkas/hyperliquid';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
}

function PerpOpenOrdersList({ isMobile }: IPerpOpenOrdersListProps) {
  const orders = usePerpOrders();
  const actions = useHyperliquidActions();
  const { getTokenInfo } = useTokenList();

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
      { key: 'TPSL', title: 'TP/SL', minWidth: 100, flex: 1, align: 'left' },
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

  const handleCancelOrder = useCallback(
    (order: FrontendOrder) => {
      const tokenInfo = getTokenInfo(order.coin);
      if (!tokenInfo) {
        console.warn(`Token info not found for coin: ${order.coin}`);
        return;
      }
      void actions.current.cancelOrder({
        orders: [
          {
            assetId: tokenInfo.assetId,
            oid: order.oid,
          },
        ],
      });
    },
    [getTokenInfo, actions],
  );

  const handleCancelAll = useCallback(() => {
    const ordersToCancel = orders
      .map((order) => {
        const tokenInfo = getTokenInfo(order.coin);
        if (!tokenInfo) {
          console.warn(`Token info not found for coin: ${order.coin}`);
          return null;
        }
        return {
          assetId: tokenInfo.assetId,
          oid: order.oid,
        };
      })
      .filter(Boolean);

    if (ordersToCancel.length === 0) {
      console.warn('No valid orders to cancel or token info unavailable');
      return;
    }

    void actions.current.cancelOrder({ orders: ordersToCancel });
  }, [orders, getTokenInfo, actions]);

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
        handleCancelOrder={() => handleCancelOrder(item)}
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
