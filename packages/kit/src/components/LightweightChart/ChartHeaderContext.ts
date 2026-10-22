import { createContext } from 'react';

export type IChartHeaderState = {
  settledAtTop: boolean;
  offset: number;
};

// Native pagers do not provide the legacy collapsible-tabs context.
export const ChartHeaderContext = createContext<IChartHeaderState | null>(null);
