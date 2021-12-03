import { NativeModule } from 'react-native';

export interface BuildConfigManagerInterface {
  getChannel: () => string;
}

export interface AndroidUpdateModuleInterface extends NativeModule {
  appUpdate: (appUpdateType: number) => Promise<void>;
  installUpdate: () => Promise<void>;
  checkUpdateStatus: () => Promise<{
    updateType: number;
    versionName: string;
    appStoreUrl: null;
  }>;
  cancelUpdate: () => Promise<void>;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    BuildConfigManager: BuildConfigManagerInterface;
    AndroidUpdateModule: AndroidUpdateModuleInterface;
  }
}
