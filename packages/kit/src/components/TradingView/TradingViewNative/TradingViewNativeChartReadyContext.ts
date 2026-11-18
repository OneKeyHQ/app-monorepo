import { createContext } from 'react';

export const TradingViewNativeChartReadyContext = createContext<
  (() => void) | undefined
>(undefined);
