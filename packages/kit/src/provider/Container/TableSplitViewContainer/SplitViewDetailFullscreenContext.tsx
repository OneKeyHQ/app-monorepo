import { createContext, useContext } from 'react';

export type ISetSplitViewDetailFullscreen = (isFullscreen: boolean) => void;

const SplitViewDetailFullscreenContext =
  createContext<ISetSplitViewDetailFullscreen>(() => undefined);

export const SplitViewDetailFullscreenProvider =
  SplitViewDetailFullscreenContext.Provider;

export function useSetSplitViewDetailFullscreen() {
  return useContext(SplitViewDetailFullscreenContext);
}
