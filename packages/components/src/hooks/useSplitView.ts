import { createContext, useContext, useMemo } from 'react';

export enum ESplitViewType {
  MAIN = 'main',
  SUB = 'sub',
  UNKNOWN = 'unknown',
}

export interface ISplitViewContext {
  viewType: ESplitViewType;
}

export const SplitViewContext = createContext<ISplitViewContext>({
  viewType: ESplitViewType.UNKNOWN,
});

function useSplitView() {
  return useContext(SplitViewContext);
}

export function useSplitViewType() {
  const splitViewContext = useSplitView();
  return splitViewContext.viewType;
}

export function useSplitMainView() {
  const splitViewContext = useSplitView();
  return useMemo(
    () => splitViewContext.viewType === ESplitViewType.MAIN,
    [splitViewContext],
  );
}

export function useSplitSubView() {
  const splitViewContext = useSplitView();
  return useMemo(
    () => splitViewContext.viewType === ESplitViewType.SUB,
    [splitViewContext],
  );
}
