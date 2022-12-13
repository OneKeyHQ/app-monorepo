import { KeyTagRoutes } from './enums';

export type IKeyTagSetPasswordParams = {
  mnemonic?: string;
};

export type IKeytagRoutesParams = {
  [KeyTagRoutes.StartedKeytag]: undefined;
  [KeyTagRoutes.ImportKeytag]: undefined;
  [KeyTagRoutes.IntroduceKeyTag]: undefined;
  [KeyTagRoutes.KeyTagBackUpWallet]: undefined;
  [KeyTagRoutes.ShowDotMap]: {
    mnemonicWords: string;
  };
  // [KeyTagRoutes.SetPassword]: IKeyTagSetPasswordParams | undefined;
};
