import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  type IDebugRenderTrackerProps,
  useUpdateEffect,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useAppIsLockedAtom,
  usePerpsActiveAssetAtom,
  usePerpsLastUsedLeverageAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getValidPriceDecimals,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  usePerpTradesHistory,
  usePerpTradesHistoryViewAllUrl,
} from '../../../hooks/usePerpOrderInfoPanel';
import { useShowPositionShare } from '../../../hooks/useShowPositionShare';
import { TradesHistoryRow } from '../Components/TradesHistoryRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpTradesHistoryListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
}

function PerpTradesHistoryList({
  isMobile,
  useTabsList,
}: IPerpTradesHistoryListProps) {
  const intl = useIntl();
  const { trades, currentListPage, setCurrentListPage, isLoading } =
    usePerpTradesHistory();
  const { onViewAllUrl } = usePerpTradesHistoryViewAllUrl();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [lastUsedLeverage] = usePerpsLastUsedLeverageAtom();
  const { showPositionShare } = useShowPositionShare();

  const getLeverage = useCallback(
    async (coin: string): Promise<number> => {
      if (lastUsedLeverage?.[coin]) {
        return lastUsedLeverage[coin];
      }
      if (activeAsset?.coin === coin && activeAsset?.universe?.maxLeverage) {
        return activeAsset.universe.maxLeverage;
      }
      try {
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({ coin });
        return symbolMeta?.universe?.maxLeverage || 1;
      } catch {
        return 1;
      }
    },
    [activeAsset, lastUsedLeverage],
  );

  const calculateEntryPrice = useCallback((fill: IFill): BigNumber | null => {
    const sizeBN = new BigNumber(fill.sz);
    if (sizeBN.isZero()) {
      return null;
    }

    const exitPriceBN = new BigNumber(fill.px);
    const pnlPerUnit = new BigNumber(fill.closedPnl).dividedBy(sizeBN);
    const normalizedDir = fill.dir.toLowerCase();

    if (normalizedDir.includes('close long')) {
      return exitPriceBN.minus(pnlPerUnit);
    }

    if (normalizedDir.includes('close short')) {
      return exitPriceBN.plus(pnlPerUnit);
    }

    return null;
  }, []);

  const handleShare = useCallback(
    async (fill: IFill) => {
      const closedPnlBN = new BigNumber(fill.closedPnl).minus(
        new BigNumber(fill.fee),
      );
      if (closedPnlBN.isZero()) {
        return;
      }
      const leverage = await getLeverage(fill.coin);
      const entryPriceBN = calculateEntryPrice(fill);

      const isLong = fill.side === 'A';
      let pnlPercent = '0';
      let entryPrice = '0';

      if (entryPriceBN?.gt(0)) {
        const decimals = getValidPriceDecimals(entryPriceBN.toFixed());
        entryPrice = entryPriceBN.toFixed(decimals);

        const positionSize = new BigNumber(fill.sz);
        const investedCapital = positionSize
          .multipliedBy(entryPriceBN)
          .dividedBy(leverage);

        if (investedCapital.gt(0)) {
          pnlPercent = closedPnlBN
            .dividedBy(investedCapital)
            .times(100)
            .toFixed(2);
        }
      }
      const parsed = parseDexCoin(fill.coin);
      showPositionShare({
        side: isLong ? 'long' : 'short',
        token: fill.coin,
        tokenDisplayName: parsed.displayName,
        pnl: String(closedPnlBN),
        pnlPercent,
        leverage,
        entryPrice,
        markPrice: fill.px,
        priceType: 'exit',
      });
    },
    [calculateEntryPrice, getLeverage, showPositionShare],
  );
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
        align: 'left',
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

  const renderTradesHistoryRow = useCallback(
    (item: IFill, _index: number) => {
      return (
        <TradesHistoryRow
          fill={item}
          isMobile={isMobile}
          cellMinWidth={totalMinWidth}
          columnConfigs={columnsConfig}
          index={_index}
          onShare={handleShare}
        />
      );
    },
    [isMobile, totalMinWidth, columnsConfig, handleShare],
  );
  const [isLocked] = useAppIsLockedAtom();

  useUpdateEffect(() => {
    if (!isLocked) {
      void backgroundApiProxy.serviceHyperliquidSubscription.refreshSubscriptionForUserFills();
    }
  }, [isLocked]);

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await backgroundApiProxy.serviceHyperliquidSubscription.refreshSubscriptionForUserFills();
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
      data={trades}
      isMobile={isMobile}
      minTableWidth={totalMinWidth}
      renderRow={renderTradesHistoryRow}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_trade_history_empty_desc,
      })}
      enablePagination
      paginationToBottom={isMobile}
      listLoading={isLoading}
      onViewAll={!isMobile ? onViewAllUrl : undefined}
    />
  );
}

export { PerpTradesHistoryList };
