import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  type IDebugRenderTrackerProps,
  type IPageNavigationProp,
  Skeleton,
  XStack,
  YStack,
  useUpdateEffect,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
  usePerpsTwapSliceFillsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useAppIsLockedAtom,
  usePerpsActiveAccountAtom,
  useSpotPairDisplayNameMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import type {
  IFill,
  ITwapSliceFill,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  usePerpTradesHistory,
  usePerpTradesHistoryViewAllUrl,
} from '../../../hooks/usePerpOrderInfoPanel';
import { useShareTradeHistory } from '../../../hooks/useShareTradeHistory';
import { PerpMobileEmptyState } from '../Components/PerpMobileEmptyState';
import {
  type ITradeHistoryFilters,
  filterTradeHistory,
  getTradeHistoryMarketOptions,
} from '../Components/tradeFillDisplay';
import { TradesHistoryRow } from '../Components/TradesHistoryRow';
import { TRADES_HISTORY_SHARE_ACTION_WIDTH } from '../Components/TradesHistoryShareAction';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { IFundingHistoryMarketOption } from '../fundingHistoryDisplay';

const TRADES_HISTORY_PAGE_SIZE = 20;
const DEFAULT_FILTERS: ITradeHistoryFilters = { type: 'all', side: 'all' };

function MobileTradesHistoryLoadingSkeleton() {
  return (
    <YStack>
      {[0, 1, 2, 3].map((index) => (
        <YStack
          key={index}
          mx="$5"
          my="$2"
          bg="$bgSubdued"
          borderRadius="$3"
          overflow="hidden"
        >
          <XStack
            px="$3"
            py="$3"
            justifyContent="space-between"
            alignItems="center"
          >
            <YStack gap="$1">
              <XStack gap="$2" alignItems="center">
                <Skeleton w="$12" h="$3.5" />
                <Skeleton w="$8" h="$3" />
              </XStack>
              <Skeleton w="$28" h="$3" />
            </YStack>
            <YStack gap="$1" alignItems="flex-end">
              <Skeleton w="$12" h="$3" />
              <Skeleton w="$14" h="$3" />
            </YStack>
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}

type IFillWithOid = IFill & {
  oid?: number;
};

type IFillWithTwapId = IFill & {
  twapId?: number;
};

function isTwapTradeFill(fill: IFill): boolean {
  return typeof (fill as IFillWithTwapId).twapId === 'number';
}

function getFillKey(fill: IFill): string {
  const fillWithOid = fill as IFillWithOid;
  if (typeof fill.tid === 'number') {
    return `tid:${fill.tid}`;
  }
  return `${fill.hash}-${fillWithOid.oid ?? ''}-${fill.time}-${fill.coin}-${
    fill.side
  }-${fill.px}-${fill.sz}`;
}

function filterTwapSliceFillsFromTrades({
  trades,
  twapSliceFills,
}: {
  trades: IFill[];
  twapSliceFills: ITwapSliceFill[];
}): IFill[] {
  if (twapSliceFills.length === 0) {
    return trades.filter((fill) => !isTwapTradeFill(fill));
  }

  const twapFillKeys = new Set<string>();
  twapSliceFills.forEach((record) => {
    twapFillKeys.add(getFillKey(record.fill));
  });

  return trades.filter(
    (fill) => !isTwapTradeFill(fill) && !twapFillKeys.has(getFillKey(fill)),
  );
}

interface IPerpTradesHistoryListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  filters?: ITradeHistoryFilters;
  onMarketOptionsChange?: (options: IFundingHistoryMarketOption[]) => void;
}

function PerpTradesHistoryList({
  isMobile,
  useTabsList,
  filters = DEFAULT_FILTERS,
  onMarketOptionsChange,
}: IPerpTradesHistoryListProps) {
  const intl = useIntl();
  const [activeInstrument] = useActiveTradeInstrumentAtom();
  const [spotPairDisplayMap] = useSpotPairDisplayNameMapAtom();
  const {
    trades,
    currentListPage,
    setCurrentListPage,
    isLoading,
    refreshTradesHistory,
  } = usePerpTradesHistory();
  const { onViewAllUrl } = usePerpTradesHistoryViewAllUrl();
  const actions = useHyperliquidActions();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [
    { accountAddress: twapSliceFillsAccountAddress, fills: rawTwapSliceFills },
  ] = usePerpsTwapSliceFillsAtom();
  const handleShare = useShareTradeHistory();
  const navigation = useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);

  useEffect(() => {
    void actions.current.loadTwapData();
  }, [actions, currentUser?.accountAddress]);

  const currentAccountAddress = currentUser?.accountAddress?.toLowerCase();
  const twapSliceFills = useMemo(() => {
    if (
      !currentAccountAddress ||
      twapSliceFillsAccountAddress?.toLowerCase() !== currentAccountAddress
    ) {
      return [];
    }
    return rawTwapSliceFills;
  }, [currentAccountAddress, rawTwapSliceFills, twapSliceFillsAccountAddress]);

  const nonTwapTrades = useMemo(
    () =>
      filterTwapSliceFillsFromTrades({
        trades,
        twapSliceFills,
      }),
    [trades, twapSliceFills],
  );

  const marketOptions = useMemo(
    () =>
      getTradeHistoryMarketOptions(
        filterTradeHistory(nonTwapTrades, { type: filters.type, side: 'all' }),
        spotPairDisplayMap,
      ),
    [nonTwapTrades, filters.type, spotPairDisplayMap],
  );
  useEffect(() => {
    onMarketOptionsChange?.(marketOptions);
  }, [marketOptions, onMarketOptionsChange]);
  const filteredTrades = useMemo(
    () =>
      filterTradeHistory(
        nonTwapTrades,
        filters,
        activeInstrument.coin,
        spotPairDisplayMap,
      ),
    [nonTwapTrades, filters, activeInstrument.coin, spotPairDisplayMap],
  );
  const activeMarketCoin =
    filters.market === 'active' ? activeInstrument.coin : undefined;
  useEffect(() => {
    setCurrentListPage(1);
  }, [
    filters.type,
    filters.side,
    filters.market,
    activeMarketCoin,
    setCurrentListPage,
  ]);
  const hasActiveFilter =
    filters.type !== 'all' ||
    filters.side !== 'all' ||
    filters.market !== undefined;

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
          id: ETranslations.perp_executed_size__title,
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
          id: ETranslations.perp_fee__title,
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
        minWidth: 132,
        flex: 1,
        align: 'right',
        headerRightPadding: TRADES_HISTORY_SHARE_ACTION_WIDTH,
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

  const handleViewDetails = useCallback(
    (fill: IFill) => {
      navigation.push(EModalPerpRoutes.PerpTradeHistoryDetails, {
        fill,
        builderFeeRate,
      });
    },
    [navigation, builderFeeRate],
  );

  const renderTradesHistoryRow = useCallback(
    (
      item: IFill,
      _index: number,
      renderMode?: 'full' | 'left' | 'right',
      isHovered?: boolean,
      onHoverChange?: (index: number | null) => void,
    ) => (
      <TradesHistoryRow
        fill={item}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        index={_index}
        onShare={handleShare}
        onPress={isMobile ? handleViewDetails : undefined}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        builderFeeRate={builderFeeRate}
      />
    ),
    [
      isMobile,
      totalMinWidth,
      columnsConfig,
      handleShare,
      builderFeeRate,
      handleViewDetails,
    ],
  );
  const [isLocked] = useAppIsLockedAtom();

  useUpdateEffect(() => {
    if (!isLocked) {
      void refreshTradesHistory();
    }
  }, [isLocked, refreshTradesHistory]);

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await refreshTradesHistory();
        await actions.current.loadTwapData();
      }}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'PerpTradesHistoryList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList={useTabsList}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      columns={columnsConfig}
      data={filteredTrades}
      isMobile={isMobile}
      minTableWidth={totalMinWidth}
      renderRow={renderTradesHistoryRow}
      ListEmptyComponent={
        isMobile ? (
          <PerpMobileEmptyState
            contentOffsetY={-96}
            title={intl.formatMessage({
              id: hasActiveFilter
                ? ETranslations.global_search_no_results_title
                : ETranslations.perp_trade_history_empty,
            })}
            description={intl.formatMessage({
              id: ETranslations.perp_trades_history_recent_range_desc,
            })}
          />
        ) : undefined
      }
      emptyMessage={intl.formatMessage({
        id: hasActiveFilter
          ? ETranslations.global_search_no_results_title
          : ETranslations.perp_trade_history_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_trades_history_recent_range_desc,
      })}
      enablePagination
      pageSize={TRADES_HISTORY_PAGE_SIZE}
      paginationToBottom={isMobile}
      listLoading={isLoading}
      mobileLoadingComponent={
        isMobile ? <MobileTradesHistoryLoadingSkeleton /> : undefined
      }
      onViewAll={
        !isMobile && filteredTrades.length > TRADES_HISTORY_PAGE_SIZE
          ? onViewAllUrl
          : undefined
      }
    />
  );
}

export { PerpTradesHistoryList };
