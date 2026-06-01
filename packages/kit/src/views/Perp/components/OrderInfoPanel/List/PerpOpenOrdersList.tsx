import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  type IDebugRenderTrackerProps,
  Icon,
  SizableText,
  Toast,
  XStack,
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

import { usePerpsAccountScopedCacheAddress } from '../../../hooks/usePerpsAccountScopedCacheAddress';
import { PerpTestIDs } from '../../../testIDs';
import {
  getPerpsAccountScopedListData,
  isPerpsAccountAddressMatched,
  isPerpsAccountScopedDataReady,
} from '../../../utils/accountScopedData';
import { buildHelpUrl, openGuideUrl } from '../../Guide/perpGuideData';
import { showCancelAllOrdersDialog } from '../CancelAllOrdersModal';
import { MobileOpenOrdersListHeader } from '../Components/MobileOpenOrdersListHeader';
import { MobileTwapOpenOrdersRow } from '../Components/MobileTwapOpenOrdersRow';
import { OpenOrdersRow } from '../Components/OpenOrdersRow';
import { OrderInfoSubTabs } from '../Components/OrderInfoSubTabs';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpOpenOrdersListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
}

type IOpenOrdersSubTab = 'basic' | 'twap';
type IOpenOrdersDisplayRow =
  | {
      type: 'single';
      order: IPerpsFrontendOrder;
    }
  | {
      type: 'twap';
      order: IPerpsActiveTwapOrder;
    };

function MobileTwapEmptyState() {
  const intl = useIntl();
  const handleGuidePress = useCallback(() => {
    openGuideUrl(buildHelpUrl('articles/13988742'));
  }, []);

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      p="$6"
      gap="$3"
    >
      <SizableText size="$bodyMdMedium" color="$text" textAlign="center">
        {intl.formatMessage({ id: ETranslations.perp_no_active_twap__title })}
      </SizableText>
      <Button
        testID={PerpTestIDs.TwapEmptyGuideButton}
        width={180}
        borderRadius="$full"
        size="small"
        h={28}
        px="$3"
        variant="secondary"
        onPress={handleGuidePress}
        childrenAsText={false}
      >
        <XStack gap="$1.5" alignItems="center">
          <Icon name="BookOpenOutline" size="$4" />
          <SizableText size="$bodySmMedium">
            {intl.formatMessage({
              id: ETranslations.perp_twap_trading_guide__action,
            })}
          </SizableText>
        </XStack>
      </Button>
    </YStack>
  );
}

function useOpenOrdersColumnsConfig({
  openOrdersLength,
  enableCancelAll,
  scopedAccountAddress,
}: {
  openOrdersLength: number;
  enableCancelAll: boolean;
  scopedAccountAddress?: string | null;
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
            onPress: () =>
              showCancelAllOrdersDialog(undefined, scopedAccountAddress),
          }),
      },
    ],
    [enableCancelAll, intl, openOrdersLength, scopedAccountAddress],
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
  const [perpOpenOrdersState] = usePerpsActiveOpenOrdersAtom();
  const [spotOpenOrdersState] = useSpotActiveOpenOrdersAtom();
  const [twapOrdersState] = usePerpsActiveTwapOrdersAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const accountScopedAddress = usePerpsAccountScopedCacheAddress();
  const [filterByCurrentToken] = useOrderFilterByCurrentTokenAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const actions = useHyperliquidActions();
  const [currentListPage, setCurrentListPage] = useState(1);
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
  const isTwapSubTabActive = isMobile && activeOpenOrdersSubTab === 'twap';
  const listLoading = Boolean(
    accountScopedAddress &&
    ((isTwapSubTabActive &&
      scopedTwapOrders.length === 0 &&
      !twapOrdersReady) ||
      (!isTwapSubTabActive &&
        openOrders.length === 0 &&
        (!perpOpenOrdersReady || !spotOpenOrdersReady))),
  );

  useEffect(() => {
    setCurrentListPage(1);
    if (isMobile) {
      void actions.current.loadTwapData();
    }
  }, [actions, currentUser?.accountAddress, isMobile]);
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
      return scopedTwapOrders;
    }
    return scopedTwapOrders.filter(
      (order) => order.state.coin === activeTradeInstrument.coin,
    );
  }, [activeTradeInstrument, filterByCurrentToken, isMobile, scopedTwapOrders]);

  const openOrdersSubTabs = useMemo<
    {
      key: IOpenOrdersSubTab;
      label: string;
    }[]
  >(() => {
    const basicCount =
      filteredOrders.length > 0 ? ` (${filteredOrders.length})` : '';
    const twapCount =
      filteredTwapOrders.length > 0 ? ` (${filteredTwapOrders.length})` : '';
    return [
      {
        key: 'basic',
        label: `${intl.formatMessage({
          id: ETranslations.perp_basic_order__title,
        })}${basicCount}`,
      },
      {
        key: 'twap',
        label: `${intl.formatMessage({
          id: ETranslations.perp_twap_order__title,
        })}${twapCount}`,
      },
    ];
  }, [filteredOrders.length, filteredTwapOrders.length, intl]);

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
    enableCancelAll: canMutateScopedOrders,
    scopedAccountAddress: accountScopedAddress,
  });

  const handleCancelOrder = useCallback(
    async (order: IPerpsFrontendOrder) => {
      try {
        await actions.current.ensureTradingEnabled();
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: order.coin,
          });
        const tokenInfo = symbolMeta;
        if (!tokenInfo) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_token_info_not_found__msg,
            }),
          });
          return;
        }
        await actions.current
          .cancelOrder({
            orders: [
              {
                assetId: tokenInfo.assetId,
                oid: order.oid,
              },
            ],
          })
          .catch(() => undefined);
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error ? error.message : 'Failed to cancel order',
        });
      }
    },
    [actions, intl],
  );

  const handleCancelTwapOrder = useCallback(
    async (order: IPerpsActiveTwapOrder) => {
      try {
        await actions.current.ensureTradingEnabled();
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: order.state.coin,
          });
        if (!symbolMeta) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_token_info_not_found__msg,
            }),
          });
          return;
        }
        await actions.current
          .cancelTwapOrder({
            assetId: symbolMeta.assetId,
            twapId: order.twapId,
          })
          .catch(() => undefined);
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.perp_failed_cancel_twap_order__msg,
                }),
        });
      }
    },
    [actions, intl],
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
        <MobileTwapOpenOrdersRow
          order={item.order}
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
        tabs={openOrdersSubTabs}
        activeTab={activeOpenOrdersSubTab}
        onChange={setActiveOpenOrdersSubTab}
      />
      <MobileOpenOrdersListHeader
        totalOrderCount={filteredOrders.length + filteredTwapOrders.length}
        cancelableOrderCount={
          canMutateScopedOrders && activeOpenOrdersSubTab === 'basic'
            ? filteredOrders.length
            : 0
        }
        scopedAccountAddress={accountScopedAddress}
      />
    </YStack>
  ) : null;
  const listEmptyComponent =
    isMobile && activeOpenOrdersSubTab === 'twap' ? (
      <MobileTwapEmptyState />
    ) : undefined;

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
        if (isMobile) {
          await actions.current.loadTwapData();
        }
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
      ListEmptyComponent={listEmptyComponent}
      ListHeaderComponent={mobileListHeader}
    />
  );
}

export { PerpOpenOrdersList };
