import { useCallback, useEffect, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import {
  type IDebugRenderTrackerProps,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveTwapOrder,
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useOrderFilterByCurrentTokenAtom,
  usePerpsActiveOpenOrdersAtom,
  usePerpsActiveTwapOrdersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountAtom,
  useSpotActiveOpenOrdersAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';
import { MobileOpenOrdersListHeader } from '../Components/MobileOpenOrdersListHeader';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';
import { OrderInfoSubTabs } from '../Components/OrderInfoSubTabs';
import { TwapOpenOrdersRow } from '../Components/TwapOpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
}

type IOpenOrdersSubTab = 'basic' | 'twap';
const OPEN_ORDERS_SUB_TABS: {
  key: IOpenOrdersSubTab;
  label: string;
}[] = [
  { key: 'basic', label: '基础单' },
  { key: 'twap', label: 'TWAP 订单' },
];

type IOpenOrdersDisplayRow =
  | {
      type: 'single';
      order: IPerpsFrontendOrder;
    }
  | {
      type: 'twap';
      order: IPerpsActiveTwapOrder;
    };

function useOpenOrdersColumnsConfig({
  openOrdersLength,
  enableCancelAll,
}: {
  openOrdersLength: number;
  enableCancelAll: boolean;
}) {
  const intl = useIntl();

  return useMemo(
    (): IColumnConfig[] => [
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
        key: 'reduceOnly',
        title: intl.formatMessage({
          id: ETranslations.perps_reduce_only,
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
        minWidth: 80,
        align: 'right',
        flex: 1,
        fixed: true,
        ...(enableCancelAll &&
          openOrdersLength > 0 && {
            onPress: () => showCancelAllOrdersDialog(),
          }),
      },
    ],
    [enableCancelAll, intl, openOrdersLength],
  );
}

function PerpOpenOrdersList({
  isMobile,
  useTabsList,
  disableListScroll,
}: IPerpOpenOrdersListProps) {
  const intl = useIntl();
  const [activeOpenOrdersSubTab, setActiveOpenOrdersSubTab] =
    useState<IOpenOrdersSubTab>('basic');
  const [{ openOrders: perpOpenOrders }] = usePerpsActiveOpenOrdersAtom();
  const [{ openOrders: spotOpenOrders }] = useSpotActiveOpenOrdersAtom();
  const [{ twapOrders }] = usePerpsActiveTwapOrdersAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [filterByCurrentToken] = useOrderFilterByCurrentTokenAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const actions = useHyperliquidActions();
  const [currentListPage, setCurrentListPage] = useState(1);
  const openOrders = useMemo(
    () =>
      [...perpOpenOrders, ...spotOpenOrders].toSorted(
        (a, b) => b.timestamp - a.timestamp,
      ),
    [perpOpenOrders, spotOpenOrders],
  );
  useEffect(() => {
    noop(currentUser?.accountAddress);
    setCurrentListPage(1);
    void actions.current.loadTwapData();
  }, [actions, currentUser?.accountAddress]);
  useEffect(() => {
    if (isMobile) {
      setCurrentListPage(1);
    }
  }, [filterByCurrentToken, isMobile]);
  useEffect(() => {
    if (isMobile && filterByCurrentToken) {
      setCurrentListPage(1);
    }
  }, [activeTradeInstrument?.coin, isMobile, filterByCurrentToken]);
  useEffect(() => {
    if (isMobile) {
      setCurrentListPage(1);
    }
  }, [activeOpenOrdersSubTab, isMobile]);

  const filteredOrders = useMemo(() => {
    if (!isMobile || !filterByCurrentToken || !activeTradeInstrument?.coin) {
      return openOrders;
    }
    return openOrders.filter(
      (order) => order.coin === activeTradeInstrument.coin,
    );
  }, [openOrders, isMobile, filterByCurrentToken, activeTradeInstrument]);

  const filteredTwapOrders = useMemo(() => {
    if (!isMobile) {
      return [];
    }
    if (!filterByCurrentToken || !activeTradeInstrument?.coin) {
      return twapOrders;
    }
    return twapOrders.filter(
      (order) => order.state.coin === activeTradeInstrument.coin,
    );
  }, [activeTradeInstrument, filterByCurrentToken, isMobile, twapOrders]);

  const displayRows = useMemo<IOpenOrdersDisplayRow[]>(() => {
    const shouldShowBasicOrders =
      !isMobile || activeOpenOrdersSubTab === 'basic';
    const shouldShowTwapOrders = isMobile && activeOpenOrdersSubTab === 'twap';

    return [
      ...(shouldShowBasicOrders
        ? filteredOrders.map(
            (order): IOpenOrdersDisplayRow => ({
              type: 'single',
              order,
            }),
          )
        : []),
      ...(shouldShowTwapOrders
        ? filteredTwapOrders.map(
            (order): IOpenOrdersDisplayRow => ({
              type: 'twap',
              order,
            }),
          )
        : []),
    ];
  }, [activeOpenOrdersSubTab, filteredOrders, filteredTwapOrders, isMobile]);

  const columnsConfig = useOpenOrdersColumnsConfig({
    openOrdersLength: openOrders.length,
    enableCancelAll: true,
  });

  const handleCancelOrder = useCallback(
    async (order: IPerpsFrontendOrder) => {
      await actions.current.ensureTradingEnabled();
      const symbolMeta =
        await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
          coin: order.coin,
        });
      const tokenInfo = symbolMeta;
      if (!tokenInfo) {
        Toast.message({
          title: 'Token info not found',
        });
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

  const handleCancelTwapOrder = useCallback(
    async (order: IPerpsActiveTwapOrder) => {
      await actions.current.ensureTradingEnabled();
      const symbolMeta =
        await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
          coin: order.state.coin,
        });
      if (!symbolMeta) {
        Toast.message({
          title: 'Token info not found',
        });
        return;
      }
      void actions.current.cancelTwapOrder({
        assetId: symbolMeta.assetId,
        twapId: order.twapId,
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
  const renderOrderRow = (
    item: IOpenOrdersDisplayRow,
    _index: number,
    renderMode?: 'full' | 'left' | 'right',
    isHovered?: boolean,
    onHoverChange?: (index: number | null) => void,
  ) => {
    if (item.type === 'twap') {
      return (
        <TwapOpenOrdersRow
          order={item.order}
          isMobile={isMobile}
          cellMinWidth={totalMinWidth}
          columnConfigs={columnsConfig}
          index={_index}
          renderMode={renderMode}
          isHovered={isHovered}
          onHoverChange={onHoverChange}
          onCancelOrder={() => void handleCancelTwapOrder(item.order)}
        />
      );
    }
    return (
      <OpenOrdersRow
        order={item.order}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        handleCancelOrder={() => void handleCancelOrder(item.order)}
        index={_index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
      />
    );
  };
  const mobileListHeader = isMobile ? (
    <YStack>
      <OrderInfoSubTabs
        tabs={OPEN_ORDERS_SUB_TABS}
        activeTab={activeOpenOrdersSubTab}
        onChange={setActiveOpenOrdersSubTab}
      />
      <MobileOpenOrdersListHeader
        totalOrderCount={filteredOrders.length + filteredTwapOrders.length}
      />
    </YStack>
  ) : null;

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
        await actions.current.loadTwapData();
      }}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'PerpOpenOrdersList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList={useTabsList}
      disableListScroll={disableListScroll}
      enablePagination
      pageSize={isMobile ? 20 : 40}
      paginationToBottom={isMobile}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={displayRows}
      isMobile={isMobile}
      renderRow={renderOrderRow}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_open_order_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_open_order_empty_desc,
      })}
      ListHeaderComponent={mobileListHeader}
    />
  );
}

export { PerpOpenOrdersList };
