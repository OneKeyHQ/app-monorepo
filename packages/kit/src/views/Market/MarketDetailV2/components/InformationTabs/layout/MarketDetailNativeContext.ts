import { createContext } from 'react';

import type { SharedValue } from 'react-native-reanimated';

export const MarketDetailNativeContext = createContext<{
  focusedName: string;
  headerOffset: SharedValue<number>;
} | null>(null);

export const MarketDetailNativePageContext = createContext<{
  key: string;
  isFocused: boolean;
  scrollY: SharedValue<number>;
} | null>(null);
