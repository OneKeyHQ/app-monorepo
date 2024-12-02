import { useCallback, useState } from 'react';

import {
  AnimatePresence,
  Spinner,
  Stack,
  usePropsAndStyle,
} from '@onekeyhq/components';
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
}

export type ITradingViewProps = IBaseTradingViewProps & IStackStyle;

function Loading() {
  return (
    <Stack flex={1} alignContent="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

export function TradingView(props: ITradingViewProps & WebViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { targetToken, identifier, baseToken, ...otherProps } =
    restProps as IBaseTradingViewProps;
  const [showLoading, changeShowLoading] = useState(true);
  const tradingViewProps = useTradingViewProps({
    targetToken,
    identifier,
    baseToken,
  });
  const onLoadEnd = useCallback(() => {
    changeShowLoading(false);
  }, []);
  return (
    <Stack bg="$bgApp" style={style as ViewStyle}>
      <WebView
        tradingViewProps={tradingViewProps}
        style={{ flex: 1 }}
        onLoadEnd={onLoadEnd}
        {...otherProps}
      />
      <AnimatePresence>
        {showLoading ? (
          <Stack
            bg="$bgApp"
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            opacity={1}
            flex={1}
            animation="quick"
            exitStyle={{
              opacity: 0,
            }}
          >
            <Loading />
          </Stack>
        ) : null}
      </AnimatePresence>
    </Stack>
  );
}
