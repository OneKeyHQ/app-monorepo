import { createContext } from 'react';

export type ISpotlightScrollState = Readonly<{
  pageKey: string;
  headerSettledAtTop: boolean;
}>;

// Undefined keeps the legacy Tabs path; null is an attached source still unknown.
export const SpotlightScrollStateContext = createContext<
  ISpotlightScrollState | null | undefined
>(undefined);
