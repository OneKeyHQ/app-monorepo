import { Stack, useOrientation, usePropsAndStyle } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

export function TradingViewV1(props: ITradingViewProps & WebViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { targetToken, identifier, baseToken, ...otherProps } =
    restProps as IBaseTradingViewProps;
  const tradingViewProps = useTradingViewProps({
    targetToken,
    identifier,
    baseToken,
  });
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;

  return (
    <Stack position="relative" style={style as ViewStyle}>
      <WebView
        tradingViewProps={tradingViewProps}
        style={{ flex: 1 }}
        {...otherProps}
      />
      {platformEnv.isNativeIOS || isIPadPortrait ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={isIPadPortrait ? 50 : 40}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
}
