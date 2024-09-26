import { useMemo } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import { type IStackStyle, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../WebView';

interface IBaseTradingViewProps {
  symbol: string;
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

const babelUrl = 'https://s.tradingview.com/widgetembed';
export function TradingView(props: ITradingViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { symbol } = restProps as IBaseTradingViewProps;
  const [settings] = useSettingsPersistAtom();
  const url = useMemo(
    () =>
      `${babelUrl}?${new URLSearchParams({
        hideideas: '1',
        overrides: JSON.stringify({}),
        enabled_features: JSON.stringify([]),
        disabled_features: JSON.stringify([]),
        locale: settings.locale,
      }).toString()}#{"symbol":"BINANCE:${symbol}USD"}`,
    [settings.locale, symbol],
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
