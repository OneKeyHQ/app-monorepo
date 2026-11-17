import { createContext } from 'react';

export type ISpotlightScrollState = Readonly<{
  pageKey: string;
  headerSettledAtTop: boolean;
}>;

// Undefined means no native source; null is an attached source still unknown.
export const SpotlightScrollStateContext = createContext<
  ISpotlightScrollState | null | undefined
>(undefined);
