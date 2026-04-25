import { useCallback, useEffect, useMemo, useState } from 'react';

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
  useSpotPairDisplayMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getSpotTokenDisplayName,
  getValidPriceDecimals,
  isSpotInstrument,
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

const TRADES_HISTORY_PAGE_SIZE = 20;

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
  const [spotPairDisplayMap] = useSpotPairDisplayMapAtom();
  const { showPositionShare } = useShowPositionShare();
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);

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

    // Spot Sell realizes PnL against the avg cost basis acquired through
    // prior Buy fills — same math as a perp Close Long. closedPnl from HL
    // is gross (before fee), so this returns the true avg entry price.
    if (
      normalizedDir === 'sell' &&
      !new BigNumber(fill.closedPnl).isZero()
    ) {
      return exitPriceBN.minus(pnlPerUnit);
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
      const isSpot = isSpotInstrument(fill.coin);
      // Spot has no leverage concept; skip the perp meta lookup and fix at 1.
      const leverage = isSpot ? 1 : await getLeverage(fill.coin);
      const entryPriceBN = calculateEntryPrice(fill);

      // Spot fill.side: 'B' = buy (~long), 'A' = sell (~short).
      // Perp fill.side: 'A' encodes long via existing convention.
      const isLong = isSpot ? fill.side === 'B' : fill.side === 'A';
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
      // Spot pair display: try the WS-supplied display map (e.g. @149→HYPE),
      // then fall back to splitting the canonical "BASE/QUOTE" form, then
      // raw coin. parseDexCoin only handles perps and would return '@149'
      // verbatim for spot pairs — wrong for the share image.
      let tokenDisplayName: string;
      if (isSpot) {
        const mapped = spotPairDisplayMap[fill.coin];
        if (mapped) {
          tokenDisplayName = mapped;
        } else if (fill.coin.includes('/')) {
          const [baseName] = fill.coin.split('/');
          tokenDisplayName = getSpotTokenDisplayName(baseName);
        } else {
          tokenDisplayName = fill.coin;
        }
      } else {
        tokenDisplayName = parseDexCoin(fill.coin).displayName;
      }
      const exitPriceBN = new BigNumber(fill.px);
      const exitPriceDecimals = getValidPriceDecimals(fill.px);
      const exitPrice = exitPriceBN.isFinite()
        ? exitPriceBN.toFixed(exitPriceDecimals)
        : '0';
      // Spot fills have no separate entry/exit — the same `fill.px` is both
      // the executed trade price and the visible share price. Showing
      // entryPrice='0' alongside the trade price reads as broken; mirror
      // the trade price into both fields so the share image is internally
      // consistent until we add a spot-specific share layout.
      const shareEntryPrice = isSpot && entryPrice === '0' ? exitPrice : entryPrice;
      showPositionShare({
        mode: isSpot ? 'spot' : 'perp',
        side: isLong ? 'long' : 'short',
        token: fill.coin,
        tokenDisplayName,
        pnl: String(closedPnlBN),
        pnlPercent,
        leverage,
        entryPrice: shareEntryPrice,
        markPrice: exitPrice,
        priceType: 'exit',
      });
    },
    [calculateEntryPrice, getLeverage, showPositionShare, spotPairDisplayMap],
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
        minWidth: 80,
        flex: 1,
        align: 'right',
        fixed: true,
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
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        builderFeeRate={builderFeeRate}
      />
    ),
    [isMobile, totalMinWidth, columnsConfig, handleShare, builderFeeRate],
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
        id: ETranslations.perp_trades_history_recent_range_desc,
      })}
      enablePagination
      pageSize={TRADES_HISTORY_PAGE_SIZE}
      paginationToBottom={isMobile}
      listLoading={isLoading}
      onViewAll={
        !isMobile && trades.length > TRADES_HISTORY_PAGE_SIZE
          ? onViewAllUrl
          : undefined
      }
    />
  );
}

export { PerpTradesHistoryList };
