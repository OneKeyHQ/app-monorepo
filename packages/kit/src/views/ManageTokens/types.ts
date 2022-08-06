export enum ManageTokenRoutes {
  Listing = 'ListTokensModal',
  AddToken = 'AddToken',
  ViewToken = 'ViewToken',
  CustomToken = 'CustomToken',
  VerifiedToken = 'VerifiedToken',
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
      }
    | { query: string };
  [ManageTokenRoutes.ViewToken]: {
    name: string;
    symbol: string;
    address: string;
    decimal: number;
    logoURI: string;
    verified?: boolean;
  };
  [ManageTokenRoutes.VerifiedToken]: {
    source: string[];
  };
  [ManageTokenRoutes.CustomToken]:
    | { address?: string; networkId?: string }
    | undefined;
};
