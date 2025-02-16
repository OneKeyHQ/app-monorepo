import { Stack, usePropsAndStyle } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';

import { useTradingViewProps } from './useTradingViewProps';
import { WebView } from './WebView';

import type { ViewStyle } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

interface IBaseTradingViewProps {
  mode: 'overview' | 'realtime';
  identifier: string;
  baseToken: string;
  targetToken: string;
  onLoadEnd: () => void;
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

export function TradingView(props: ITradingViewProps & WebViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { targetToken, identifier, baseToken, ...otherProps } =
    restProps as IBaseTradingViewProps;
  const tradingViewProps = useTradingViewProps({
    targetToken,
    identifier,
    baseToken,
  });
  return (
    <Stack bg="$bgApp" style={style as ViewStyle}>
      <WebView
        tradingViewProps={tradingViewProps}
        style={{ flex: 1 }}
        {...otherProps}
      />
    </Stack>
  );
}
