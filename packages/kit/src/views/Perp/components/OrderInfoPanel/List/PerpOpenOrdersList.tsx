import { useCallback, useEffect, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
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
  usePerpsScaleOrderGroupsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountAtom,
  useSpotActiveOpenOrdersAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IScaleOrderChild,
  IScaleOrderGroup,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { usePerpsAccountScopedCacheAddress } from '../../../hooks/usePerpsAccountScopedCacheAddress';
import {
  getPerpsAccountScopedListData,
  isPerpsAccountAddressMatched,
  isPerpsAccountScopedDataReady,
} from '../../../utils/accountScopedData';
import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';
import { MobileOpenOrdersListHeader } from '../Components/MobileOpenOrdersListHeader';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';
import { ScaleOpenOrdersGroupRow } from '../Components/ScaleOpenOrdersGroupRow';
import { TwapOpenOrdersRow } from '../Components/TwapOpenOrdersRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
}

type IFrontendOrderWithCloid = IPerpsFrontendOrder & {
  cloid?: string | null;
};

type IOpenOrdersDisplayRow =
  | {
      type: 'single';
      order: IPerpsFrontendOrder;
    }
  | {
      type: 'scaleGroup';
      group: IScaleOrderGroup;
      childOrders: IPerpsFrontendOrder[];
      expanded: boolean;
    }
  | {
      type: 'scaleChild';
      group: IScaleOrderGroup;
      child: IScaleOrderChild;
      order: IPerpsFrontendOrder;
    }
  | {
      type: 'twap';
      order: IPerpsActiveTwapOrder;
    };

function getFrontendOrderCloid(order: IPerpsFrontendOrder): string | undefined {
  return (order as IFrontendOrderWithCloid).cloid ?? undefined;
}

function PerpOpenOrdersList({
  isMobile,
  useTabsList,
  disableListScroll,
}: IPerpOpenOrdersListProps) {
  const intl = useIntl();
  const [perpOpenOrdersState] = usePerpsActiveOpenOrdersAtom();
  const [spotOpenOrdersState] = useSpotActiveOpenOrdersAtom();
  const [scaleOrderGroupsState] = usePerpsScaleOrderGroupsAtom();
  const [twapOrdersState] = usePerpsActiveTwapOrdersAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const accountScopedAddress = usePerpsAccountScopedCacheAddress();
  const [filterByCurrentToken] = useOrderFilterByCurrentTokenAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const actions = useHyperliquidActions();
  const [currentListPage, setCurrentListPage] = useState(1);
  const [scaleGroupExpandedOverrides, setScaleGroupExpandedOverrides] =
    useState<Record<string, boolean>>({});
  const canMutateScopedOrders = isPerpsAccountAddressMatched({
    activeAccountAddress: currentUser?.accountAddress,
    dataAccountAddress: accountScopedAddress,
  });
  const scopedPerpOpenOrders = useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: accountScopedAddress,
        dataAccountAddress: perpOpenOrdersState.accountAddress,
        data: perpOpenOrdersState.openOrders,
      }),
    [
      accountScopedAddress,
      perpOpenOrdersState.accountAddress,
      perpOpenOrdersState.openOrders,
    ],
  );
  const scopedSpotOpenOrders = useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: accountScopedAddress,
        dataAccountAddress: spotOpenOrdersState.accountAddress,
        data: spotOpenOrdersState.openOrders,
      }),
    [
      accountScopedAddress,
      spotOpenOrdersState.accountAddress,
      spotOpenOrdersState.openOrders,
    ],
  );
  const scopedScaleOrderGroups = useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: accountScopedAddress,
        dataAccountAddress: scaleOrderGroupsState.accountAddress,
        data: scaleOrderGroupsState.groups,
      }),
    [
      accountScopedAddress,
      scaleOrderGroupsState.accountAddress,
      scaleOrderGroupsState.groups,
    ],
  );
  const scopedTwapOrders = useMemo(
    () =>
      getPerpsAccountScopedListData({
        activeAccountAddress: accountScopedAddress,
        dataAccountAddress: twapOrdersState.accountAddress,
        data: twapOrdersState.twapOrders,
      }),
    [
      accountScopedAddress,
      twapOrdersState.accountAddress,
      twapOrdersState.twapOrders,
    ],
  );
  const openOrders = useMemo(
    () =>
      [...scopedPerpOpenOrders, ...scopedSpotOpenOrders].toSorted(
        (a, b) => b.timestamp - a.timestamp,
      ),
    [scopedPerpOpenOrders, scopedSpotOpenOrders],
  );
  const perpOpenOrdersReady = isPerpsAccountScopedDataReady({
    activeAccountAddress: accountScopedAddress,
    dataAccountAddress: perpOpenOrdersState.accountAddress,
  });
  const spotOpenOrdersReady = isPerpsAccountScopedDataReady({
    activeAccountAddress: accountScopedAddress,
    dataAccountAddress: spotOpenOrdersState.accountAddress,
  });
  const twapOrdersReady = isPerpsAccountScopedDataReady({
    activeAccountAddress: accountScopedAddress,
    dataAccountAddress: twapOrdersState.accountAddress,
  });
  const listLoading = Boolean(
    accountScopedAddress &&
    openOrders.length === 0 &&
    scopedTwapOrders.length === 0 &&
    (!perpOpenOrdersReady || !spotOpenOrdersReady || !twapOrdersReady),
  );
  useEffect(() => {
    noop(currentUser?.accountAddress);
    setCurrentListPage(1);
    void actions.current.loadScaleOrderGroups();
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

  const filteredOrders = useMemo(() => {
    if (!isMobile || !filterByCurrentToken || !activeTradeInstrument?.coin) {
      return openOrders;
    }
    return openOrders.filter(
      (order) => order.coin === activeTradeInstrument.coin,
    );
  }, [openOrders, isMobile, filterByCurrentToken, activeTradeInstrument]);

  const filteredTwapOrders = useMemo(() => {
    if (!isMobile || !filterByCurrentToken || !activeTradeInstrument?.coin) {
      return scopedTwapOrders;
    }
    return scopedTwapOrders.filter(
      (order) => order.state.coin === activeTradeInstrument.coin,
    );
  }, [activeTradeInstrument, filterByCurrentToken, isMobile, scopedTwapOrders]);

  const displayRows = useMemo<IOpenOrdersDisplayRow[]>(() => {
    const childByCloid = new Map<
      string,
      { group: IScaleOrderGroup; child: IScaleOrderChild }
    >();
    const childByOid = new Map<
      number,
      { group: IScaleOrderGroup; child: IScaleOrderChild }
    >();
    scopedScaleOrderGroups.forEach((group) => {
      group.children.forEach((child) => {
        childByCloid.set(child.cloid, { group, child });
        if (child.oid) {
          childByOid.set(child.oid, { group, child });
        }
      });
    });
    const getScaleInfo = (order: IPerpsFrontendOrder) => {
      const cloid = getFrontendOrderCloid(order);
      return (
        (cloid ? childByCloid.get(cloid) : undefined) ??
        childByOid.get(order.oid)
      );
    };

    const openOrdersByGroupId = new Map<string, IPerpsFrontendOrder[]>();
    filteredOrders.forEach((order) => {
      const scaleInfo = getScaleInfo(order);
      if (!scaleInfo) {
        return;
      }
      const orders = openOrdersByGroupId.get(scaleInfo.group.id) ?? [];
      orders.push(order);
      openOrdersByGroupId.set(scaleInfo.group.id, orders);
    });

    const emittedGroups = new Set<string>();
    const rows: IOpenOrdersDisplayRow[] = [];
    let defaultExpandedChildRows = 0;

    filteredOrders.forEach((order) => {
      const scaleInfo = getScaleInfo(order);
      if (!scaleInfo) {
        rows.push({ type: 'single', order });
        return;
      }

      const groupId = scaleInfo.group.id;
      if (emittedGroups.has(groupId)) {
        return;
      }
      emittedGroups.add(groupId);

      const childOrders =
        openOrdersByGroupId.get(groupId)?.toSorted((a, b) => {
          const aChild = getScaleInfo(a);
          const bChild = getScaleInfo(b);
          return (aChild?.child.index ?? 0) - (bChild?.child.index ?? 0);
        }) ?? [];
      const defaultExpanded =
        !isMobile &&
        childOrders.length <= 10 &&
        defaultExpandedChildRows + childOrders.length <= 50;
      if (defaultExpanded) {
        defaultExpandedChildRows += childOrders.length;
      }
      const expanded = scaleGroupExpandedOverrides[groupId] ?? defaultExpanded;
      rows.push({
        type: 'scaleGroup',
        group: scaleInfo.group,
        childOrders,
        expanded,
      });
      if (expanded) {
        childOrders.forEach((childOrder) => {
          const childInfo = getScaleInfo(childOrder);
          if (childInfo) {
            rows.push({
              type: 'scaleChild',
              group: childInfo.group,
              child: childInfo.child,
              order: childOrder,
            });
          }
        });
      }
    });

    filteredTwapOrders.forEach((order) => {
      rows.push({ type: 'twap', order });
    });

    return rows;
  }, [
    filteredOrders,
    filteredTwapOrders,
    isMobile,
    scaleGroupExpandedOverrides,
    scopedScaleOrderGroups,
  ]);

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
        ...(openOrders.length > 0 &&
          canMutateScopedOrders && {
            onPress: () =>
              showCancelAllOrdersDialog(undefined, accountScopedAddress),
          }),
      },
    ],
    [accountScopedAddress, canMutateScopedOrders, intl, openOrders.length],
  );

  const handleCancelOrder = useCallback(
    async (order: IPerpsFrontendOrder) => {
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

  const handleCancelScaleGroup = useCallback(
    async (group: IScaleOrderGroup, childOrders: IPerpsFrontendOrder[]) => {
      await actions.current.ensureTradingEnabled();
      void actions.current.cancelScaleOrderGroup({
        groupId: group.id,
        orders: childOrders.map((order) => ({
          assetId: group.assetId,
          oid: order.oid,
        })),
      });
    },
    [actions],
  );
  const handleCancelScaleChild = useCallback(
    async (group: IScaleOrderGroup, order: IPerpsFrontendOrder) => {
      await actions.current.ensureTradingEnabled();
      void actions.current.cancelScaleOrderGroup({
        groupId: group.id,
        orders: [
          {
            assetId: group.assetId,
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
        console.warn(`Token info not found for coin: ${order.state.coin}`);
        return;
      }
      void actions.current.cancelTwapOrder({
        assetId: symbolMeta.assetId,
        twapId: order.twapId,
      });
    },
    [actions],
  );

  const toggleScaleGroupExpanded = useCallback(
    (groupId: string, currentExpanded: boolean) => {
      setScaleGroupExpandedOverrides((prev) => ({
        ...prev,
        [groupId]: !currentExpanded,
      }));
    },
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
    if (item.type === 'scaleGroup') {
      return (
        <ScaleOpenOrdersGroupRow
          group={item.group}
          childOrders={item.childOrders}
          isMobile={isMobile}
          cellMinWidth={totalMinWidth}
          columnConfigs={columnsConfig}
          index={_index}
          renderMode={renderMode}
          isHovered={isHovered}
          onHoverChange={onHoverChange}
          expanded={item.expanded}
          onToggleExpand={() =>
            toggleScaleGroupExpanded(item.group.id, item.expanded)
          }
          onCancelGroup={() =>
            void handleCancelScaleGroup(item.group, item.childOrders)
          }
        />
      );
    }
    const order = item.type === 'single' ? item.order : item.order;
    return (
      <OpenOrdersRow
        order={order}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        handleCancelOrder={() =>
          item.type === 'scaleChild'
            ? void handleCancelScaleChild(item.group, order)
            : void handleCancelOrder(order)
        }
        index={_index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        isScaleChild={item.type === 'scaleChild'}
        scaleLegIndex={
          item.type === 'scaleChild' ? item.child.index : undefined
        }
      />
    );
  };
  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
        await actions.current.loadScaleOrderGroups();
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
      listLoading={listLoading}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_open_order_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_open_order_empty_desc,
      })}
      ListHeaderComponent={
        isMobile ? (
          <MobileOpenOrdersListHeader
            totalOrderCount={openOrders.length + scopedTwapOrders.length}
            canCancelAll={canMutateScopedOrders && openOrders.length > 0}
            scopedAccountAddress={accountScopedAddress}
          />
        ) : null
      }
    />
  );
}

export { PerpOpenOrdersList };
