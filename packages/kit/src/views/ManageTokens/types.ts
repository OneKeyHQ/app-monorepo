import type { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import type { Token } from '@onekeyhq/engine/src/types/token';

export enum ManageTokenRoutes {
  Listing = 'ListTokensModal',
  AddToken = 'AddToken',
  ActivateToken = 'ActivateToken',
  ViewToken = 'ViewToken',
  CustomToken = 'CustomToken',
  VerifiedToken = 'VerifiedToken',
  PriceAlertList = 'PriceAlertList',
  PriceAlertAdd = 'PriceAlertAdd',
  TokenRiskDetail = 'TokenRiskDetail',
}

export type ManageTokenRoutesParams = {
  [ManageTokenRoutes.Listing]: undefined;
  [ManageTokenRoutes.AddToken]:
    | {
        name: string;
        symbol: string;
        address: string;
        decimal: number;
        logoURI: string;
        verified?: boolean;
        security?: boolean;
        source?: string;
        sendAddress?: string;
      }
    | { query: string };
  [ManageTokenRoutes.ActivateToken]: {
    walletId: string;
    accountId: string;
    networkId: string;
    tokenId: string;
    onSuccess?: () => void;
    onFailure?: (error?: Error) => void;
  };
  [ManageTokenRoutes.ViewToken]: {
    name: string;
    symbol: string;
    address: string;
    decimal: number;
    logoURI: string;
    verified?: boolean;
    source?: string;
    security?: boolean;
    sendAddress?: string;
  };
  [ManageTokenRoutes.VerifiedToken]: {
    token: Partial<Token>;
  };
  [ManageTokenRoutes.CustomToken]:
    | { address?: string; networkId?: string; sendAddress?: string }
    | undefined;
  [ManageTokenRoutes.PriceAlertList]: {
    token: Token;
  };
  [ManageTokenRoutes.TokenRiskDetail]: {
    token: Partial<Token>;
  };
  [ManageTokenRoutes.PriceAlertAdd]: {
    token: Token;
    alerts: PriceAlertItem[];
  };
};
