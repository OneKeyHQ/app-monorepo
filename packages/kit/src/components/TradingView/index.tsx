import { useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { PanResponder } from 'react-native';

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

const EDGE_THRESHOLD = 50;

export function TradingView(props: ITradingViewProps & WebViewProps) {
  const [restProps, style] = usePropsAndStyle(props);
  const { targetToken, identifier, baseToken, ...otherProps } =
    restProps as IBaseTradingViewProps;
  const tradingViewProps = useTradingViewProps({
    targetToken,
    identifier,
    baseToken,
  });

  const navigation = useNavigation();
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gestureState) => {
        return gestureState.x0 < EDGE_THRESHOLD;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy, x0 } = gestureState;
        return x0 < EDGE_THRESHOLD && Math.abs(dx) > Math.abs(dy) && dx > 0;
      },
      onPanResponderGrant: (_, gestureState) => {
        const { x0 } = gestureState;
        if (x0 < EDGE_THRESHOLD) {
          navigation.setOptions({ gesturesEnabled: true });
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy, x0 } = gestureState;
        if (x0 < EDGE_THRESHOLD && Math.abs(dx) > Math.abs(dy) && dx > 0) {
          navigation.setOptions({ gesturesEnabled: true });
        } else {
          navigation.setOptions({ gesturesEnabled: false });
        }
      },
      onPanResponderRelease: () => {
        navigation.setOptions({ gesturesEnabled: true });
      },
    }),
  ).current;

  return (
    <Stack {...panResponder.panHandlers} bg="$bgApp" style={style as ViewStyle}>
      <WebView
        tradingViewProps={tradingViewProps}
        style={{ flex: 1 }}
        {...otherProps}
      />
    </Stack>
  );
}
