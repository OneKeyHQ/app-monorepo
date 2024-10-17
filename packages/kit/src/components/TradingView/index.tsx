import { useMedia, usePropsAndStyle } from '@tamagui/core';

import type { IStackStyle } from '@onekeyhq/components';

import { useTradingViewUri } from './useTradingViewUri';
import { WebView } from './WebView';

import type { ViewStyle } from 'react-native';

interface IBaseTradingViewProps {
  symbol: string;
  mode: 'overview' | 'realtime';
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

export function TradingView(props: ITradingViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { symbol } = restProps as IBaseTradingViewProps;
  const { gtMd } = useMedia();
  const uri = useTradingViewUri(symbol, { hideSideToolbar: !gtMd });

  return <WebView uri={uri} style={style as ViewStyle} />;
}
