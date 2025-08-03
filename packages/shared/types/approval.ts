import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IAddressInfo } from './address';
import type { IToken } from './token';

export type IAccountApproval = {
  tokenAddress: string;
  spenderAddress: string;
  allowance: string;
  allowanceParsed: string;
  isInfiniteAmount: boolean;
};

export type IFetchAccountApprovalsParams = {
  accountId: string;
  networkId: string;
  spenderAddress?: string;
  accountAddress?: string;
  limit?: number;
  dbAccount?: IDBAccount;
};

export type IFetchAccountApprovalsResponse = {
  approvals: IAccountApproval[];
  tokens: Record<
    string,
    {
      price: string;
      price24h: string;
      info: IToken;
    }
  >;
  addressMap: Record<string, IAddressInfo>;
};
