import { useCallback, useEffect, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveOpenOrdersAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { FrontendOrder } from '@nktkas/hyperliquid';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
}

function PerpOpenOrdersList({ isMobile }: IPerpOpenOrdersListProps) {
  const intl = useIntl();
  const [{ openOrders: orders }] = usePerpsActiveOpenOrdersAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const actions = useHyperliquidActions();
  const [currentListPage, setCurrentListPage] = useState(1);
  useEffect(() => {
    noop(currentUser?.accountAddress);
    setCurrentListPage(1);
  }, [currentUser?.accountAddress]);

  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'time',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_time }),
        minWidth: 100,
        align: 'left',
      },
      {
        key: 'asset',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        width: 80,
        align: 'left',
      },

      {
        key: 'type',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_type }),
        minWidth: 120,
        align: 'left',
        flex: 1,
      },
      {
        key: 'size',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_size }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'originalSize',
        title: intl.formatMessage({
          id: ETranslations.perp_open_orders_original_size,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'value',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_value }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'executePrice',
        title: intl.formatMessage({
          id: ETranslations.perp_open_orders_execute_price,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'triggerCondition',
        title: intl.formatMessage({
          id: ETranslations.perp_open_orders_trigger_condition,
        }),
        minWidth: 160,
        flex: 1,
        align: 'left',
      },
      {
        key: 'TPSL',
        title: intl.formatMessage({
          id: ETranslations.perp_position_tp_sl,
        }),
        minWidth: 140,
        flex: 1,
        align: 'center',
      },
      {
        key: 'cancel',
        title: intl.formatMessage({
          id: ETranslations.perp_open_orders_cancel_all,
        }),
        minWidth: 100,
        align: 'right',
        flex: 1,
        ...(orders.length > 0 && {
          onPress: () => showCancelAllOrdersDialog(),
        }),
      },
    ],
    [intl, orders.length],
  );

  const handleCancelOrder = useCallback(
    async (order: FrontendOrder) => {
      await actions.current.ensureTradingEnabled();
      const symbolMeta =
        await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
          coin: order.coin,
        });
      const tokenInfo = symbolMeta;
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
    [actions],
  );

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
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
      }}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'PerpOpenOrdersList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList
      enablePagination={!isMobile}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={orders}
      isMobile={isMobile}
      renderRow={renderOrderRow}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_open_order_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_open_order_empty_desc,
      })}
    />
  );
}

export { PerpOpenOrdersList };
