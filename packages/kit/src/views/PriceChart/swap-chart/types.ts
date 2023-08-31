import type { Token } from '@onekeyhq/engine/src/types/token';

import type { StyleProp, ViewStyle } from 'react-native';

export type SwapChartProps = {
  style?: StyleProp<ViewStyle>;
  fromToken: Token;
  toToken: Token;
};
