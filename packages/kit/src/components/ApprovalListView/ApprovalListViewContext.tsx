import { createContext, useContext } from 'react';

export interface IApprovalListViewContextValue {
  accountId: string;
  networkId: string;
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
    tableLayout: false,
    hideRiskBadge: false,
    selectDisabled: false,
    searchDisabled: false,
    filterByNetworkDisabled: false,
    isAllNetworks: false,
  });

export const useApprovalListViewContext = () =>
  useContext(ApprovalListViewContext);
