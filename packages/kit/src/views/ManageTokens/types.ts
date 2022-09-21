import { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import { Token } from '@onekeyhq/engine/src/types/token';

export enum ManageTokenRoutes {
  Listing = 'ListTokensModal',
  AddToken = 'AddToken',
  ActivateToken = 'ActivateToken',
  ViewToken = 'ViewToken',
  CustomToken = 'CustomToken',
  VerifiedToken = 'VerifiedToken',
  PriceAlertList = 'PriceAlertList',
  PriceAlertAdd = 'PriceAlertAdd',
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
        source: string[];
      }
    | { query: string };
  [ManageTokenRoutes.ActivateToken]: {
    accountId: string;
    networkId: string;
    tokenId: string;
    onSuccess?: () => void;
    onFailure?: () => void;
  };
  [ManageTokenRoutes.ViewToken]: {
    name: string;
    symbol: string;
    address: string;
    decimal: number;
    logoURI: string;
    verified?: boolean;
    source: string[];
  };
  [ManageTokenRoutes.VerifiedToken]: {
    source: string[];
  };
  [ManageTokenRoutes.CustomToken]:
    | { address?: string; networkId?: string }
    | undefined;
  [ManageTokenRoutes.PriceAlertList]: {
    token: Token;
  };
  [ManageTokenRoutes.PriceAlertAdd]: {
    token: Token;
    alerts: PriceAlertItem[];
  };
};
