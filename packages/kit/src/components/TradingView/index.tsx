import { useCallback, useMemo } from 'react';

import { usePropsAndStyle } from '@tamagui/core';

import { Button, type IStackStyle, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import WebView from '../WebView';

import { htmlCode } from './htmlCode';

interface IBaseTradingViewProps {
  symbol: string;
  mode: 'overview' | 'realtime';
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

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

  const url = useMemo(() => {
    if (platformEnv.isNative) {
    } else {
      const blob = new Blob([htmlCode], {
        type: 'text/html',
      });
      return URL.createObjectURL(blob)
    }
  }, []);

  return platformEnv.isNative ? (
    <Stack style={style as any}>
      {/* <Button onPress={openRealtimePage}>full screen</Button> */}
      {/* <WebView src={url} /> */}
    </Stack>
  ) : (
    <>
      {/* <Button onPress={openRealtimePage}>full screen</Button> */}
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
