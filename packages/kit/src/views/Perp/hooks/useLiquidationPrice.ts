import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  useAccountPanelDataAtom,
  useActiveAssetDataAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSelectedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { calculateLiquidationPrice } from '@onekeyhq/shared/src/utils/perpsUtils';

import { useCurrentTokenData } from './usePerpMarketData';
import { usePerpPositions } from './usePerpOrderInfoPanel';

export function useLiquidationPrice(): BigNumber | null {
  const [formData] = useTradingFormAtom();
  const tokenInfo = useCurrentTokenData();
  const [activeAssetData] = useActiveAssetDataAtom();
  const [accountPanelData] = useAccountPanelDataAtom();
  const { accountSummary } = accountPanelData;
  const [perpsSelectedSymbol] = usePerpsSelectedSymbolAtom();
  const perpsPositions = usePerpPositions();
  const { coin, margin } = perpsSelectedSymbol;

  const stableAccountValues = useMemo(
    () => ({
      crossAccountValue: accountSummary.crossAccountValue || '0',
      crossMaintenanceMarginUsed:
        accountSummary.crossMaintenanceMarginUsed || '0',
    }),
    [
      accountSummary.crossAccountValue,
      accountSummary.crossMaintenanceMarginUsed,
    ],
  );

  const referencePrice = useMemo(() => {
    if (formData.type === 'limit' && formData.price) {
      return new BigNumber(formData.price);
    }
    if (formData.type === 'market' && tokenInfo?.markPx) {
      return new BigNumber(tokenInfo.markPx);
    }
    return new BigNumber(0);
  }, [formData.type, formData.price, tokenInfo?.markPx]);

  const totalValue = useMemo(() => {
    const size = new BigNumber(formData.size || 0);
    return size.multipliedBy(referencePrice);
  }, [formData.size, referencePrice]);

  const leverage = useMemo(() => {
    return activeAssetData?.leverage?.value || tokenInfo?.maxLeverage;
  }, [activeAssetData?.leverage?.value, tokenInfo?.maxLeverage]);

  const currentCoinPosition = useMemo(() => {
    return perpsPositions.filter((pos) => pos.position.coin === coin)?.[0]
      ?.position;
  }, [perpsPositions, coin]);

  const liquidationPrice: BigNumber | null = useMemo(() => {
    if (!leverage || !activeAssetData?.leverage.type) return null;

    const positionSize = new BigNumber(formData.size || 0);
    if (positionSize.isZero()) return null;

    // Use unified function - it will automatically choose the optimal calculation path
    const _liquidationPrice = calculateLiquidationPrice({
      totalValue,
      referencePrice,
      markPrice: tokenInfo?.markPx
        ? new BigNumber(tokenInfo?.markPx)
        : undefined,
      positionSize,
      side: formData.side,
      leverage,
      mode: activeAssetData?.leverage.type,
      marginTiers: margin?.marginTiers,
      maxLeverage: tokenInfo?.maxLeverage || 1,
      crossMarginUsed: new BigNumber(stableAccountValues.crossAccountValue),
      crossMaintenanceMarginUsed: new BigNumber(
        stableAccountValues.crossMaintenanceMarginUsed,
      ),
      // Optional existing position parameters - function will check if they're meaningful
      existingPositionSize: currentCoinPosition
        ? new BigNumber(currentCoinPosition.szi)
        : undefined,
      existingEntryPrice: currentCoinPosition
        ? new BigNumber(currentCoinPosition.entryPx)
        : undefined,
      newOrderSide: formData.side,
    });
    return _liquidationPrice?.gt(0) ? _liquidationPrice : null;
  }, [
    leverage,
    activeAssetData?.leverage.type,
    tokenInfo?.markPx,
    tokenInfo?.maxLeverage,
    formData.size,
    formData.side,
    currentCoinPosition,
    referencePrice,
    margin?.marginTiers,
    stableAccountValues,
    totalValue,
  ]);

  return liquidationPrice;
}
