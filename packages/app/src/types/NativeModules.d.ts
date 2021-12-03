import { NativeModule } from 'react-native';

export interface BuildConfigManagerInterface {
  getChannel: () => string;
}

export interface InAppUpdateInterface extends NativeModule {
  checkUpdate: () => void;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    BuildConfigManager: BuildConfigManagerInterface;
    InAppUpdate: InAppUpdateInterface;
  }
}
