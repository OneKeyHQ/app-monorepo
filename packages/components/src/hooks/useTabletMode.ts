import { createContext, useContext, useMemo } from 'react';

export enum ETabletViewType {
  MAIN = 'main',
  DETAIL = 'detail',
  UNKNOWN = 'unknown',
}

export interface ITabletViewContext {
  viewType: ETabletViewType;
}

export const TabletModeViewContext = createContext<ITabletViewContext>({
  viewType: ETabletViewType.UNKNOWN,
});

function useTabletView() {
  return useContext(TabletModeViewContext);
}

export function useIsTabletMainView() {
  const tableViewContext = useTabletView();
  return useMemo(
    () => tableViewContext.viewType === ETabletViewType.MAIN,
    [tableViewContext],
  );
}

export function useIsTabletDetailView() {
  const tableViewContext = useTabletView();
  return useMemo(
    () => tableViewContext.viewType === ETabletViewType.DETAIL,
    [tableViewContext],
  );
}
