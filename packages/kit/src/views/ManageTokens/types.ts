import type { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import type { Token, TokenRiskLevel } from '@onekeyhq/engine/src/types/token';

import type { ManageTokenModalRoutes } from '../../routes/routesEnum';

export type ManageTokenRoutesParams = {
  [ManageTokenModalRoutes.Listing]: undefined;
  [ManageTokenModalRoutes.AddToken]:
    | {
        name: string;
        symbol: string;
        address: string;
        decimal: number;
        logoURI: string;
        source?: string;
        sendAddress?: string;
        riskLevel: TokenRiskLevel;
      }
    | { query: string };
  [ManageTokenModalRoutes.ActivateToken]: {
    walletId: string;
    accountId: string;
    networkId: string;
    tokenId: string;
    onSuccess?: () => void;
    onFailure?: (error?: Error) => void;
  };
  [ManageTokenModalRoutes.ViewToken]: {
    name: string;
    symbol: string;
    address: string;
    decimal: number;
    logoURI: string;
    source?: string;
    sendAddress?: string;
    riskLevel?: TokenRiskLevel;
  };
  [ManageTokenModalRoutes.VerifiedToken]: {
    token: Partial<Token>;
  };
  [ManageTokenModalRoutes.CustomToken]:
    | { address?: string; networkId?: string; sendAddress?: string }
    | undefined;
  [ManageTokenModalRoutes.PriceAlertList]: {
    price: number;
    token: Token;
  };
  [ManageTokenModalRoutes.TokenRiskDetail]: {
    token: Partial<Token>;
  };
  [ManageTokenModalRoutes.PriceAlertAdd]: {
    price: number;
    token: Token;
    alerts: PriceAlertItem[];
  };
};
