import { createContext } from 'react';

import type { SharedValue } from 'react-native-reanimated';

export type IChartHeaderState = {
  headerHeight: number;
  headerOffset: SharedValue<number>;
};

// Native pagers do not provide the legacy collapsible-tabs context.
export const ChartHeaderContext = createContext<IChartHeaderState | null>(null);
