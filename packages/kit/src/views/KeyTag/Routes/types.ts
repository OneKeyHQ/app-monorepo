import type { IWallet } from '@onekeyhq/engine/src/types';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { KeyTagRoutes } from './enums';

export type IkeyTagShowDotMapParams = {
  mnemonic: string;
  wallet?: IWallet;
};

export type IKeytagRoutesParams = {
  [KeyTagRoutes.StartedKeytag]: undefined;
  [KeyTagRoutes.ImportKeytag]: undefined;
  [KeyTagRoutes.IntroduceKeyTag]: undefined;
  [KeyTagRoutes.KeyTagBackUpWallet]: undefined;
  [KeyTagRoutes.ShowDotMap]: IkeyTagShowDotMapParams;
  [KeyTagRoutes.EnterPhrase]: undefined;
  [KeyTagRoutes.KeyTagVerifyPassword]: {
    walletId: string;
    wallet?: IWallet;
  };
  [KeyTagRoutes.KeyTagAttention]: {
    walletId: string;
    password: string;
    wallet?: IWallet;
  };
  [HomeRoutes.HomeOnboarding]: undefined;
};
