import { createContext, useContext } from 'react';

export interface IApprovalManagementContextValue {
  isBuildingRevokeTxs: boolean;
  setIsBuildingRevokeTxs: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTokens: Record<string, boolean>;
  setSelectedTokens: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
}

export const ApprovalManagementContext =
  createContext<IApprovalManagementContextValue>({
    isBuildingRevokeTxs: false,
    setIsBuildingRevokeTxs: () => {},
    selectedTokens: {},
    setSelectedTokens: () => {},
  });

export const useApprovalManagementContext = () =>
  useContext(ApprovalManagementContext);
