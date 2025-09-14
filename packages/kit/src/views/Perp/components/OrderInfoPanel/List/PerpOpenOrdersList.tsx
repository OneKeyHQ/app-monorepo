import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpOrders } from '../../../hooks/usePerpOrderInfoPanel';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { FrontendOrder } from '@nktkas/hyperliquid';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
}

function PerpOpenOrdersList({ isMobile }: IPerpOpenOrdersListProps) {
  const intl = useIntl();
  const orders = usePerpOrders();
  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'asset',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        width: 120,
        align: 'left',
      },
      {
        key: 'time',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_time }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'type',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_type }),
        minWidth: 100,
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
      },
    ],
    [intl],
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
