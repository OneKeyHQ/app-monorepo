import type { IReactNativeModules } from '@onekeyhq/shared/types/rnNativeModules';

declare module 'react-native' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface NativeModulesStatic extends IReactNativeModules {
    // no additional members
    this_is_mocked_method: () => string;
  }
}

export {};
