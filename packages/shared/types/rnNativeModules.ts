import type { IAppleCloudKitNativeModule } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type { IAppleKeyChainNativeModule } from '@onekeyhq/shared/src/storage/AppleKeyChainStorage/types';

export type IReactNativeModules = {
  CloudKitModule: IAppleCloudKitNativeModule | undefined;
  KeychainModule: IAppleKeyChainNativeModule | undefined;
  RootViewBackground: {
    setBackground: (r: number, g: number, b: number, a: number) => void;
  };
};
