import type { Token } from '@onekeyhq/engine/src/types/token';

export enum RevokeRoutes {
  ShareModal = 'ShareModal',
  ChangeAllowance = 'ChangeAllowance',
}

export type RevokeRoutesParams = {
  [RevokeRoutes.ShareModal]: undefined;
  [RevokeRoutes.ChangeAllowance]: {
    dapp: {
      name: string;
      spender: string;
    };
    allowance: string;
    balance: string;
    token: Token;
    networkId: string;
  };
};

export enum AssetType {
  tokens = 0,
  nfts,
}

export type Filter = {
  assetType: AssetType;
  includeUnverifiedTokens: boolean;
  includeZeroBalancesTokens: boolean;
  includeTokensWithoutAllowances: boolean;
};
