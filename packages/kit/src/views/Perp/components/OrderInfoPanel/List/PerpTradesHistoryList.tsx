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
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsLastUsedLeverageAtom,
  usePerpsUserFillsCacheAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';
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
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [userFillsCache] = usePerpsUserFillsCacheAtom();
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

  const calculateEntryPrice = useCallback(
    (fill: IFill, fillIndex: number): BigNumber | null => {
      let openFills: IFill[] = [];
      let foundStartPositionZero = false;

      for (let i = fillIndex + 1; i < trades.length; i += 1) {
        const currentFill = trades[i];
        if (
          currentFill?.coin === fill.coin &&
          (currentFill.dir.includes('Open') ||
            currentFill.dir.includes('Close'))
        ) {
          openFills.unshift(currentFill);
          if (
            currentFill.startPosition &&
            new BigNumber(currentFill.startPosition).isZero()
          ) {
            foundStartPositionZero = true;
            break;
          }
        }
      }

      if (
        !foundStartPositionZero &&
        userFillsCache.userAddress &&
        userFillsCache.userAddress.toLowerCase() ===
          currentAccount?.accountAddress?.toLowerCase() &&
        userFillsCache.fills.length > 0
      ) {
        openFills = [];
        const cacheIndex = userFillsCache.fills.findIndex(
          (f) => f.oid === fill.oid && f.time === fill.time,
        );

        if (cacheIndex !== -1) {
          for (
            let i = cacheIndex + 1;
            i < userFillsCache.fills.length;
            i += 1
          ) {
            const currentFill = userFillsCache.fills[i];
            if (
              currentFill.coin === fill.coin &&
              (currentFill.dir.includes('Open') ||
                currentFill.dir.includes('Close'))
            ) {
              openFills.unshift(currentFill);
              if (
                currentFill.startPosition &&
                new BigNumber(currentFill.startPosition).isZero()
              ) {
                foundStartPositionZero = true;
                break;
              }
            }
          }
        }
      }

      if (openFills.length === 0) {
        return null;
      }

      let totalValue = new BigNumber(0);
      let totalSize = new BigNumber(0);
      for (const openFill of openFills) {
        const size = new BigNumber(openFill.sz);
        const price = new BigNumber(openFill.px);
        const side = openFill.side;
        if (side !== fill.side) {
          totalValue = totalValue.plus(price.multipliedBy(size));
          totalSize = totalSize.plus(size);
        } else {
          totalSize = totalSize.minus(size);
        }
      }

      return totalSize.gt(0) ? totalValue.dividedBy(totalSize) : null;
    },
    [currentAccount, trades, userFillsCache],
  );

  const handleShare = useCallback(
    async (fill: IFill) => {
      const closedPnlBN = new BigNumber(fill.closedPnl).minus(
        new BigNumber(fill.fee),
      );
      if (closedPnlBN.isZero()) {
        return;
      }
      const fillIndex = trades.findIndex(
        (t) => t.oid === fill.oid && t.time === fill.time,
      );
      if (fillIndex === -1) {
        return;
      }

      const leverage = await getLeverage(fill.coin);
      const entryPriceBN = calculateEntryPrice(fill, fillIndex);

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
      showPositionShare({
        side: isLong ? 'long' : 'short',
        token: fill.coin,
        pnl: closedPnlBN.toFixed(2),
        pnlPercent,
        leverage,
        entryPrice,
        markPrice: fill.px,
        priceType: 'exit',
      });
    },
    [calculateEntryPrice, getLeverage, showPositionShare, trades],
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
      void backgroundApiProxy.serviceHyperliquidSubscription.updateSubscriptionForUserFills();
    }
  }, [isLocked]);

  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await backgroundApiProxy.serviceHyperliquidSubscription.updateSubscriptionForUserFills();
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
