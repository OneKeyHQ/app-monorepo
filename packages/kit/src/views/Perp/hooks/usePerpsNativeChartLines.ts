import { useMemo } from 'react';

import { useIntl } from 'react-intl';

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
        let directionId: ETranslations = isLong
          ? ETranslations.global_buy
          : ETranslations.global_sell;
        if (isPosition) {
          directionId = isLong
            ? ETranslations.perp_long
            : ETranslations.perp_short;
        }
        const direction = intl.formatMessage({ id: directionId });
        let color =
          themeColors[
            isLong
              ? TRADING_VIEW_NATIVE_THEME_COLORS.positive
              : TRADING_VIEW_NATIVE_THEME_COLORS.negative
          ];
        if (line.kind === 'liquidation') {
          color = themeColors[TRADING_VIEW_NATIVE_THEME_COLORS.warning];
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
              style: line.kind === 'position' ? 'solid' : 'dashed',
              title: [
                direction,
                line.label?.left,
                line.label?.right ?? line.qty,
              ]
                .filter(Boolean)
                .join(' · '),
            },
          },
        ];
      }),
    [intl, lines, themeColors, canInteract, getLineId, pending],
  );
  return { chartComponents, onReferenceLineAction };
}
