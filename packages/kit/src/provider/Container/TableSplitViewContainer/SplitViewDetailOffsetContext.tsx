import { createContext, useContext } from 'react';

const SplitViewDetailOffsetContext = createContext(0);

export const SplitViewDetailOffsetProvider =
  SplitViewDetailOffsetContext.Provider;

export function useSplitViewDetailOffset() {
  return useContext(SplitViewDetailOffsetContext);
}
