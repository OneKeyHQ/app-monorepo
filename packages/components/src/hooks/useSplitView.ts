import { createContext, useContext, useMemo } from 'react';

import { useIsSplitView } from './useOrientation';

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

// True when the current component is being rendered inside the sub pane of
// the dual-pane split-view layout AND that layout is currently visible
// (landscape on iPad, spanning on dual-screen). Use to hide UI that should
// not appear in the detail pane of the split view, while still showing it in
// portrait/single-pane mode where the same screen acts as the full UI.
export function useIsSplitDetailActive() {
  const isSubView = useSplitSubView();
  const isLandscape = useIsSplitView();
  return isSubView && isLandscape;
}
