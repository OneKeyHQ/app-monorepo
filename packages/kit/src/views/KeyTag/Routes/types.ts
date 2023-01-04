import type { IWallet } from '@onekeyhq/engine/src/types';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { IOnboardingRoutesParams } from '../../Onboarding/routes/types';
import type { KeyTagRoutes } from './enums';
import type { NavigatorScreenParams } from '@react-navigation/native';

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
    navigateMode?: boolean;
  };
  [KeyTagRoutes.KeyTagAttention]: {
    walletId: string;
    password: string;
    wallet?: IWallet;
    navigateMode?: boolean;
  };
  [HomeRoutes.HomeOnboarding]: NavigatorScreenParams<IOnboardingRoutesParams>;
};
