export enum ManageTokenRoutes {
  Listing = 'ListTokensModal',
  AddToken = 'AddToken',
  ViewToken = 'ViewToken',
  CustomToken = 'CustomToken',
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
      }
    | { query: string };
  [ManageTokenRoutes.ViewToken]: {
    name: string;
    symbol: string;
    address: string;
    decimal: number;
    logoURI: string;
  };
  [ManageTokenRoutes.CustomToken]: { address?: string } | undefined;
};
