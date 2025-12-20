import { createContext, useContext } from 'react';

export interface IApprovalListViewContextValue {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  tableLayout?: boolean;
  hideRiskBadge?: boolean;
  selectDisabled?: boolean;
  searchDisabled?: boolean;
  filterByNetworkDisabled?: boolean;
  isAllNetworks?: boolean;
}

export const ApprovalListViewContext =
  createContext<IApprovalListViewContextValue>({
    accountId: '',
    networkId: '',
    indexedAccountId: undefined,
    tableLayout: false,
    hideRiskBadge: false,
    selectDisabled: false,
    searchDisabled: false,
    filterByNetworkDisabled: false,
    isAllNetworks: false,
  });

export const useApprovalListViewContext = () =>
  useContext(ApprovalListViewContext);
