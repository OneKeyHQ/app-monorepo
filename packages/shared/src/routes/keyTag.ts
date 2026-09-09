// KeyTagModal only hosts the navigation hub and the wallet selector. The actual
// content pages (view dots to back up, enter phrase, interactive dot import)
// live in the Onboarding V2 page stack.
export enum EModalKeyTagRoutes {
  UserOptions = 'Options',
  BackupWallet = 'BackupWallet',
}

export type IModalKeyTagParamList = {
  [EModalKeyTagRoutes.UserOptions]: undefined;
  [EModalKeyTagRoutes.BackupWallet]: undefined;
};
