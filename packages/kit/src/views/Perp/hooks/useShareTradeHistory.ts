import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePerpsActiveAssetAtom,
  usePerpsLastUsedLeverageAtom,
  useSpotPairDisplayMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  getSpotTokenDisplayName,
  getValidPriceDecimals,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getPerpFillDirectionType } from '../components/OrderInfoPanel/utils';

import { useShowPositionShare } from './useShowPositionShare';

export function useShareTradeHistory() {
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [lastUsedLeverage] = usePerpsLastUsedLeverageAtom();
  const [spotPairDisplayMap] = useSpotPairDisplayMapAtom();
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
    const directionType = getPerpFillDirectionType(fill.dir);

    if (directionType === 'closeLong') {
      return exitPriceBN.minus(pnlPerUnit);
    }

    if (directionType === 'closeShort') {
      return exitPriceBN.plus(pnlPerUnit);
    }

    // Spot Sell realizes PnL against the running cost basis — same math as a
    // perp Close Long, since HL's closedPnl is pre-fee on both sides.
    if (
      isSpotInstrument(fill.coin) &&
      fill.side === 'A' &&
      !new BigNumber(fill.closedPnl).isZero()
    ) {
      return exitPriceBN.minus(pnlPerUnit);
    }

    return null;
  }, []);

  const handleShare = useCallback(
    async (fill: IFill) => {
      if (isSpotInstrument(fill.coin)) {
        return;
      }
      const closedPnlBN = new BigNumber(fill.closedPnl).minus(
        new BigNumber(fill.fee),
      );
      if (closedPnlBN.isZero()) {
        return;
      }
      const isSpot = isSpotInstrument(fill.coin);
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
      // parseDexCoin only handles perp coins, so spot needs its own cascade:
      // WS-supplied display map → split "BASE/QUOTE" → raw coin.
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
      // Spot has no separate entry vs exit — mirror the trade price so the
      // share image doesn't show a misleading "$0" entry next to a real exit.
      const shareEntryPrice =
        isSpot && entryPrice === '0' ? exitPrice : entryPrice;
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
  return handleShare;
}
