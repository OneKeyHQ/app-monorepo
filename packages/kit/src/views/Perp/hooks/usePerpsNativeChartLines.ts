import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useTheme } from '@onekeyhq/components';
import { useTradingViewSettingsThemeColors } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsThemeColors';
import type { ITradingViewNativeReferenceLineComponent } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import { usePerpsChartLineActions } from './usePerpsChartLineActions';
import { usePerpsChartLines } from './usePerpsChartLines';

export function usePerpsNativeChartLines(enableTradingUi: boolean) {
  const intl = useIntl();
  const theme = useTheme();
  const labelBackground = theme.bgApp.val;
  const labelColor = theme.text.val;
  const quantityBackground = theme.bgInverse.val;
  const quantityColor = theme.textInverse.val;
  const themeColors = useTradingViewSettingsThemeColors();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const szDecimals =
    activeTradeInstrument.mode === 'spot'
      ? activeTradeInstrument.universe?.baseSzDecimals
      : activeTradeInstrument.universe?.szDecimals;
  const lines = usePerpsChartLines({
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
        const isPosition =
          line.kind === 'position' || line.kind === 'liquidation';
        const directionId: ETranslations = isLong
          ? ETranslations.global_buy
          : ETranslations.global_sell;
        const direction = intl.formatMessage({ id: directionId });
        let color =
          themeColors[
            isLong
              ? TRADING_VIEW_NATIVE_THEME_COLORS.positive
              : TRADING_VIEW_NATIVE_THEME_COLORS.negative
          ];
        if (line.kind === 'liquidation') {
          color = themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.negative];
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
              pending: Boolean(pendingAction),
              style: 'dashed',
              title: [isPosition ? undefined : direction, line.label?.left]
                .filter(Boolean)
                .join(' · '),
              label: {
                offset: line.kind === 'liquidation' ? 140 : 16,
                backgroundColor: labelBackground,
                color: labelColor,
                quantity: line.qty
                  ? {
                      text: line.qty,
                      backgroundColor: quantityBackground,
                      color: quantityColor,
                    }
                  : undefined,
              },
            },
          },
        ];
      }),
    [
      intl,
      lines,
      themeColors,
      labelBackground,
      labelColor,
      quantityBackground,
      quantityColor,
      canInteract,
      getLineId,
      pending,
    ],
  );
  return { chartComponents, onReferenceLineAction };
}
