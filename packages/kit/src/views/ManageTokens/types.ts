export enum ManageTokenModalRoutes {
  ListTokensModal = 'ListTokensModal',
  AddTokenModal = 'AddTokenModal',
  AddCustomTokenModal = 'AddCustomTokenModal',
}

export type ManageTokenRoutesParams = {
  [ManageTokenModalRoutes.ListTokensModal]: undefined;
  [ManageTokenModalRoutes.AddTokenModal]: undefined;
  [ManageTokenModalRoutes.AddCustomTokenModal]: undefined;
};
