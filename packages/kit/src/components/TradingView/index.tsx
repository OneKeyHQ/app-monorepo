import { useMemo } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import { type IStackStyle, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import WebView from '../WebView';

interface IBaseTradingViewProps {
  symbol: string;
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

const babelUrl = 'https://s.tradingview.com/widgetembed';
export function TradingView(props: ITradingViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { symbol } = restProps as IBaseTradingViewProps;
  const theme = useThemeVariant();
  const locale = useLocaleVariant();
  const url = useMemo(
    () =>
      `${babelUrl}?${new URLSearchParams({
        hideideas: '1',
        overrides: JSON.stringify({}),
        enabled_features: JSON.stringify([]),
        disabled_features: JSON.stringify([]),
        locale,
        theme,
      }).toString()}#{"symbol":"BINANCE:${symbol}USD"}`,
    [locale, symbol, theme],
  );
  return platformEnv.isNative ? (
    <Stack style={style as any}>
      <WebView src={url} />
    </Stack>
  ) : (
    <iframe
      style={{
        ...(style as any),
        border: 0,
      }}
      frameBorder="0"
      title="TradingView"
      src={url}
      sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin"
    />
  );
}
