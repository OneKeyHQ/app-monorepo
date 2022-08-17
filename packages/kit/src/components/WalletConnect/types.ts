// import type { WalletService } from '@walletconnect/react-native-dapp';
// TODO rename IWalletConnectWalletService
export type WalletService = {
  id: string;
  name: string;
  homepage: string;
  chains: string[];
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
