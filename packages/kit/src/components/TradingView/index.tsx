import { useMedia, usePropsAndStyle } from '@tamagui/core';

import type { IStackStyle } from '@onekeyhq/components';

import { useHtmlCode } from './htmlCode';
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
  const htmlCode = useHtmlCode(symbol, { hideSideToolbar: !gtMd });

  return <WebView htmlCode={htmlCode} style={style as ViewStyle} />;
}
