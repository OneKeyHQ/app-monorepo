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
  /**
   * Optional fields that are primarily used by TradingViewV2.
   * They are declared here as optional so that shared callers (e.g. <TradingView />)
   * can pass them without causing type-checking errors when the runtime component
   * happens to render TradingViewV1 instead of TradingViewV2.
   */
  tokenAddress?: string;
  networkId?: string;
  tradingViewUrl?: string;
  interval?: string;
  timeFrom?: number;
  timeTo?: number;
  decimal?: number;
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

export function TradingViewV1(props: ITradingViewProps & WebViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const {
    targetToken,
    identifier,
    baseToken,
    // Strip out TradingViewV2-specific optional props so they are not forwarded to the inner WebView.
    tokenAddress: _tokenAddress,
    networkId: _networkId,
    tradingViewUrl: _tradingViewUrl,
    interval: _interval,
    timeFrom: _timeFrom,
    timeTo: _timeTo,
    decimal: _decimal,
    ...otherProps
  } = restProps as IBaseTradingViewProps;
  const tradingViewProps = useTradingViewProps({
    targetToken,
    identifier,
    baseToken,
  });
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;

  return (
    <Stack
      position="relative"
      paddingBottom={
        (platformEnv.isNative && !platformEnv.isNativeIOSPad) || isIPadPortrait
          ? 60
          : 0
      }
      style={style as ViewStyle}
    >
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
