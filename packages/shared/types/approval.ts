import type { IAddressInfo } from './address';
import type { IToken } from './token';

export enum EContractApprovalAlertType {
  Risk = 'risk',
  Warning = 'warning',
}

export enum ERevokeTxStatus {
  Succeeded = 'Succeeded',
  Processing = 'Processing',
  Pending = 'Pending',
  Skipped = 'Skipped',
  Paused = 'Paused',
}

export enum ERevokeProgressState {
  InProgress = 'InProgress',
  Finished = 'Finished',
  Aborted = 'Aborted',
  Paused = 'Paused',
}

export type IRevokeTxStatus = {
  status: ERevokeTxStatus;
  txId?: string;
  feeBalance?: string;
  feeSymbol?: string;
  feeFiat?: string;
  skippedReason?: string;
};

export type IContractApproval = {
  accountId: string;
  networkId: string;
  owner: string;
  latestApprovalTime: number;
  highestRiskLevel: number;
  riskReason?: string;
  contractAddress: string;
  approvals: IApproval[];
  isRiskContract?: boolean;
  isInactiveApproval?: boolean;
};

export type IApproval = {
  tokenAddress: string;
  spenderAddress: string;
  networkId: string;
  allowance: string;
  allowanceParsed: string;
  isInfiniteAmount: boolean;
  time: number;
  riskLevel: number;
  reason?: string;
};

export type IFetchAccountApprovalsParams = {
  accountId: string;
  networkId: string;
  indexedAccountId: string | undefined;
  accountAddress?: string;
  limit?: number;
};

export type IFetchAccountApprovalsResponse = {
  contractApprovals: Omit<IContractApproval, 'accountId' | 'owner'>[];
  tokenMap: Record<
    string,
    {
      price: string;
      price24h: string;
      info: IToken;
    }
  >;
  contractMap: Record<string, IAddressInfo>;
};
