import { useMemo } from 'react';

import { useTheme } from '@onekeyhq/components';
import { useTradingViewSettingsThemeColors } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';
import type { ITradingViewNativeReferenceLineComponent } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import { useActivePerpsChartInstrument } from './usePerpsChartInstrument';
import { usePerpsChartLineActions } from './usePerpsChartLineActions';
import { usePerpsChartLines } from './usePerpsChartLines';

import type { IPerpsChartInstrument } from './usePerpsChartInstrument';

// Defaults to the active trade instrument; a split-view panel passes its own
// and keeps `enableTradingUi` off, so its lines are informational.
export function usePerpsNativeChartLines(
  enableTradingUi: boolean,
  target?: IPerpsChartInstrument,
) {
  const theme = useTheme();
  const labelBackground = theme.bgApp.val;
  const labelColor = theme.text.val;
  const quantityBackground = theme.bgInverse.val;
  const quantityColor = theme.textInverse.val;
  const orderQuantityColor = theme.textOnColor.val;
  const themeColors = useTradingViewSettingsThemeColors();
  const activeInstrument = useActivePerpsChartInstrument();
  const activeTradeInstrument = target ?? activeInstrument;
  const [currentAccount] = usePerpsActiveAccountAtom();
  const { szDecimals } = activeTradeInstrument;
  const lines = usePerpsChartLines({
    instrument: activeTradeInstrument,
    symbol: activeTradeInstrument.coin,
    szDecimals: szDecimals ?? 2,
    userAddress: currentAccount?.accountAddress,
  });
  const { canInteract, getLineId, onReferenceLineAction, pending } =
    usePerpsChartLineActions({
      lines,
      enabled: enableTradingUi && szDecimals !== undefined,
      symbol: activeTradeInstrument.coin,
      szDecimals: szDecimals ?? 2,
      isSpot: activeTradeInstrument.mode === 'spot',
    });

  const chartComponents = useMemo(
    () =>
      lines.flatMap<ITradingViewNativeReferenceLineComponent>((line) => {
        const id = getLineId(line);
        const pendingAction = pending[id];
        const price = pendingAction?.price ?? Number(line.price);
        if (!Number.isFinite(price) || price <= 0) {
          return [];
        }

        const isLong = line.side === 'long';
        const isLimitOrder = line.kind === 'order';
        let labelOffset = 16;
        let color =
          themeColors[
            isLong
              ? TRADING_VIEW_NATIVE_THEME_COLORS.positive
              : TRADING_VIEW_NATIVE_THEME_COLORS.negative
          ];
        if (line.kind === 'liquidation') {
          color = themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.negative];
          labelOffset = 140;
        } else if (line.kind === 'position') {
          color =
            themeColors[
              line.pnlPositive
                ? TRADING_VIEW_NATIVE_THEME_COLORS.positive
                : TRADING_VIEW_NATIVE_THEME_COLORS.negative
            ];
        } else if (line.kind === 'tp') {
          color = themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.positive];
        } else if (line.kind === 'sl') {
          color = themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.negative];
        }

        return [
          {
            id,
            type: 'referenceLine',
            props: {
              anchor: { type: 'price', price },
              color,
              interactive: canInteract && Boolean(line.meta?.orderId),
              cancelable: Boolean(line.meta?.orderId),
              draggable: line.editable === true,
              pending: pendingAction?.type,
              style: isLimitOrder ? 'dotted' : 'dashed',
              title: line.label?.left ?? '',
              label: {
                variant: isLimitOrder ? 'order' : undefined,
                offset: isLimitOrder
                  ? { type: 'chartWidthPercentage', value: 70 }
                  : labelOffset,
                backgroundColor: labelBackground,
                color: isLimitOrder ? color : labelColor,
                quantity: line.qty
                  ? {
                      text: line.qty,
                      backgroundColor: isLimitOrder
                        ? color
                        : quantityBackground,
                      color: isLimitOrder ? orderQuantityColor : quantityColor,
                    }
                  : undefined,
              },
            },
          },
        ];
      }),
    [
      lines,
      themeColors,
      labelBackground,
      labelColor,
      quantityBackground,
      quantityColor,
      orderQuantityColor,
      canInteract,
      getLineId,
      pending,
    ],
  );
  return { chartComponents, onReferenceLineAction };
}
