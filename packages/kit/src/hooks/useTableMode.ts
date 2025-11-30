import { createContext, useContext, useMemo } from 'react';

export enum ETableViewType {
  MAIN = 'main',
  DETAIL = 'detail',
  UNKNOWN = 'unknown',
}

export interface ITableViewContext {
  viewType: ETableViewType;
}

export const TableModeViewContext = createContext<ITableViewContext>({
  viewType: ETableViewType.UNKNOWN,
});

function useTableView() {
  return useContext(TableModeViewContext);
}

export function useIsTableMainView() {
  const tableViewContext = useTableView();
  return useMemo(
    () => tableViewContext.viewType === ETableViewType.MAIN,
    [tableViewContext],
  );
}

export function useIsTableDetailView() {
  const tableViewContext = useTableView();
  return useMemo(
    () => tableViewContext.viewType === ETableViewType.DETAIL,
    [tableViewContext],
  );
}
