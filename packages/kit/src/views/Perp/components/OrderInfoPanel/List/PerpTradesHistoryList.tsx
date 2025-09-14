import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpTradesHistory } from '../../../hooks/usePerpOrderInfoPanel';
import { TradesHistoryRow } from '../Components/TradesHistoryRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpTradesHistoryListProps {
  isMobile?: boolean;
}

function PerpTradesHistoryList({ isMobile }: IPerpTradesHistoryListProps) {
  const intl = useIntl();
  const { trades } = usePerpTradesHistory();
  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'time',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_time }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'asset',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        width: 100,
        align: 'left',
      },
      {
        key: 'direction',
        title: intl.formatMessage({
          id: ETranslations.perp_trades_history_direction,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'price',
        title: intl.formatMessage({
          id: ETranslations.perp_trades_history_price,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'size',
        title: intl.formatMessage({
          id: ETranslations.perp_position_position_size,
        }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'value',
        title: intl.formatMessage({
          id: ETranslations.perp_trades_history_trade_value,
        }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'fee',
        title: intl.formatMessage({
          id: ETranslations.perp_trades_history_fee,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'closePnl',
        title: intl.formatMessage({
          id: ETranslations.perp_trades_close_pnl,
        }),
        minWidth: 100,
        flex: 1,
        align: 'right',
      },
    ],
    [intl],
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
      emptyMessage="No trades found"
      emptySubMessage="Your trades will appear here"
      enablePagination
      pageSize={20}
    />
  );
}

export { PerpTradesHistoryList };
