// import type { WalletService } from '@walletconnect/react-native-dapp';
// TODO rename IWalletConnectWalletService

import type { IExternalAccountInfoWalletImage } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';

import type { OneKeyWalletConnector } from './OneKeyWalletConnector';
import type { SessionTypes } from '@walletconnect-v2/types';
import type {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  IWeb3Wallet,
  Web3WalletTypes,
} from '@walletconnect-v2/web3wallet';
import type { IWalletConnectSession } from '@walletconnect/types';

export type WalletService = {
  id: string;
  name: string;
  homepage: string;
  chains: string[];
  image_url: IExternalAccountInfoWalletImage | undefined;
  app: {
    browser: string;
    ios: string;
    android: string;
    mac: string;
    windows: string;
    linux: string;
  };
  mobile: {
    native: string;
    universal: string;
  };
  desktop: {
    native: string;
    universal: string;
  };
  metadata: {
    shortName: string;
    colors: {
      primary: string;
      secondary: string;
    };
  };
};

export type IWalletConnectRequestOptions = {
  connector?: OneKeyWalletConnector; // v1
  sessionV2?: SessionTypes.Struct; // v2
  proposal?: Web3WalletTypes.SessionProposal; // v2
  sessionRequest?: Web3WalletTypes.SessionRequest; // v2
};
export type IWalletConnectUniversalSession = {
  sessionV1?: IWalletConnectSession;
  sessionV2?: SessionTypes.Struct;
};
