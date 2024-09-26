import { useCallback, useMemo } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import { Button, type IStackStyle, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import WebView from '../WebView';

interface IBaseTradingViewProps {
  symbol: string;
  mode: 'overview' | 'realtime';
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

const realtimeBaselUrl = 'https://s.tradingview.com/widgetembed';
const overviewBaseUrl =
  'https://s.tradingview.com/embed-widget/symbol-overview';

export function TradingView(props: ITradingViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { symbol, mode } = restProps as IBaseTradingViewProps;
  const theme = useThemeVariant();
  const locale = useLocaleVariant();
  const chartSymbol = useMemo(() => {
    const s = symbol.toLowerCase();
    if (s === 'usdc' || s === 'usdt') {
      return symbol;
    }
    return `${symbol}USD`;
  }, [symbol]);
  const navigation = useAppNavigation();
  const openRealtimePage = useCallback(() => {
    navigation.push(ETabMarketRoutes.MarketRealTimeTradingView, {
      symbol,
    });
  }, [navigation, symbol]);
  const url = useMemo(
    () =>
      mode === 'realtime'
        ? `${realtimeBaselUrl}?${new URLSearchParams({
            locale,
          }).toString()}#${JSON.stringify({
            symbol: `BINANCE:${chartSymbol}`,
            locale,
            theme,
          })}`
        : `${overviewBaseUrl}?${new URLSearchParams({
            locale,
          }).toString()}#${JSON.stringify({
            'symbols': [[`COINBASE:${symbol}USD|1D`]],
            'chartOnly': true,
            'colorTheme': theme,
            'autosize': true,
            'showVolume': false,
            'showMA': false,
            'hideDateRanges': false,
            'hideMarketStatus': false,
            'hideSymbolLogo': false,
            'scalePosition': 'right',
            'scaleMode': 'Normal',
            'changeMode': 'price-and-percent',
            'chartType': 'area',
            'maLineColor': '#2962FF',
            'maLineWidth': 1,
            'maLength': 9,
            'lineWidth': 2,
            'lineType': 0,
            'dateRanges': [
              '1d|1',
              '1m|30',
              '3m|60',
              '12m|1D',
              '60m|1W',
              'all|1M',
            ],
          })}`,
    [chartSymbol, locale, mode, symbol, theme],
  );
  return platformEnv.isNative ? (
    <Stack style={style as any}>
      <Button onPress={openRealtimePage}>full screen</Button>
      <WebView src={url} />
    </Stack>
  ) : (
    <>
      <Button onPress={openRealtimePage}>full screen</Button>
      <div style={style as any}>
        <iframe
          style={{
            height: '100%',
            width: '100%',
            border: 0,
          }}
          frameBorder="0"
          title="TradingView"
          src={url}
          sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin"
        />
      </div>
    </>
  );
}
