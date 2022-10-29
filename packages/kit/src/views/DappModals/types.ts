export enum DappApproveModalRoutes {
  ApproveModal = 'ApproveModal',
  SpendLimitModal = 'SpendLimitModal',
  EditFeeModal = 'EditFeeModal',
  ContractDataModal = 'ContractDataModal',
}

export type DappApproveRoutesParams = {
  [DappApproveModalRoutes.ApproveModal]?: { spendLimit?: string };
  [DappApproveModalRoutes.SpendLimitModal]: undefined;
  [DappApproveModalRoutes.EditFeeModal]: undefined;
  [DappApproveModalRoutes.ContractDataModal]: { contractData: string };
};

export enum DappConnectionModalRoutes {
  ConnectionModal = 'ConnectionModal',
  NetworkNotMatchModal = 'NetworkNotMatchModal',
}

export type DappConnectionRoutesParams = {
  [DappConnectionModalRoutes.ConnectionModal]: {
    walletConnectUri?: string;
    isDeepLink?: boolean;
  };
  [DappConnectionModalRoutes.NetworkNotMatchModal]: undefined;
};

export enum DappMulticallModalRoutes {
  MulticallModal = 'MulticallModal',
  EditFeeModal = 'EditFeeModal',
  ContractDataModal = 'ContractDataModal',
}

export type DappMulticallRoutesParams = {
  [DappMulticallModalRoutes.MulticallModal]: undefined;
  [DappMulticallModalRoutes.EditFeeModal]: undefined;
  [DappMulticallModalRoutes.ContractDataModal]: { contractData: string };
};
