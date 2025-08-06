import type { IAddressInfo } from './address';
import type { IToken } from './token';

export type IContractApproval = {
  networkId: string;
  latestApprovalTime: number;
  highestRiskLevel: number;
  riskReason?: string;
  contractAddress: string;
  approvals: IApproval[];
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
  data: {
    [networkId: string]: {
      tokens: Record<
        string,
        {
          price: string;
          price24h: string;
          info: IToken;
        }
      >;
      addressMap: Record<string, IAddressInfo>;
    } & Record<string, { approvals: IApproval[] }>;
  };
};
