import { KeyTagRoutes } from './enums';

export type IKeyTagVerifyPasswordParams = {
  walletId: string;
};

export type IkeyTagAttentionsParams = {
  walletId: string;
  password: string;
};

export type IkeyTagShowDotMapParams = {
  walletId: string;
  mnemonic: string;
};

export type IKeytagRoutesParams = {
  [KeyTagRoutes.StartedKeytag]: undefined;
  [KeyTagRoutes.ImportKeytag]: undefined;
  [KeyTagRoutes.IntroduceKeyTag]: undefined;
  [KeyTagRoutes.KeyTagBackUpWallet]: undefined;
  [KeyTagRoutes.ShowDotMap]: IkeyTagShowDotMapParams;
  [KeyTagRoutes.VerifyPassword]: IKeyTagVerifyPasswordParams;
  [KeyTagRoutes.Attentions]: IKeyTagVerifyPasswordParams;
};
