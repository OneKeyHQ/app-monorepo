import type { ILaunchOptionsManagerInterface } from '@onekeyhq/shared/src/modules/LaunchOptionsManager/type';
import type { IJSBundle } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import type { IWebViewChecker } from '@onekeyhq/shared/src/modules3rdParty/webview-checker/type';
import type { IAppleCloudKitNativeModule } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type { IAppleKeyChainNativeModule } from '@onekeyhq/shared/src/storage/AppleKeyChainStorage/types';

interface IFileParams {
  downloadUrl: string;
  filePath: string;
}

type INativeBundleUpdateModule = {
  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;
  getConstants: () => { ANDROID_CHANNEL: string };
  jsBundlePath?: () => string;
  downloadBundle: (params: any) => Promise<any>;
  verifyBundle: (params: any) => Promise<void>;
  verifyBundleASC: (params: any) => Promise<void>;
  downloadBundleASC: (params: any) => Promise<void>;
  installBundle: (params: any) => Promise<void>;
  getFallbackUpdateBundleData: () => Promise<IJSBundle[]>;
  setCurrentUpdateBundleData: (params: IJSBundle) => Promise<void>;
  clearBundle: () => Promise<void>;
  clearAllJSBundleData: () => Promise<{ success: boolean; message: string }>;
  getWebEmbedPath: () => string;
  getWebEmbedPathAsync: () => Promise<string>;
  testVerification: () => Promise<boolean>;
  testDeleteJsBundle: (
    appVersion: string,
    bundleVersion: string,
  ) => Promise<{ success: boolean; message: string }>;
  testDeleteJsRuntimeDir: (
    appVersion: string,
    bundleVersion: string,
  ) => Promise<{ success: boolean; message: string }>;
  testDeleteMetadataJson: (
    appVersion: string,
    bundleVersion: string,
  ) => Promise<{ success: boolean; message: string }>;
  testWriteEmptyMetadataJson: (
    appVersion: string,
    bundleVersion: string,
  ) => Promise<{ success: boolean; message: string }>;
  getNativeAppVersion: () => Promise<string>;
  getJsBundlePath: () => Promise<string>;
  getSha256FromFilePath: (filePath: string) => Promise<string>;
};

export type IReactNativeModules = {
  CloudKitModule: IAppleCloudKitNativeModule | undefined;
  KeychainModule: IAppleKeyChainNativeModule | undefined;
  LegacySplashScreen: {
    preventAutoHideAsync: () => Promise<boolean>;
    hideAsync: () => Promise<boolean>;
  };
  LaunchOptionsManager: ILaunchOptionsManagerInterface;
  AutoUpdateModule: {
    clearCache: () => Promise<void>;
    downloadAPK: (
      params: IFileParams & {
        notificationTitle: string;
      },
    ) => Promise<void>;
    downloadASC: (params: IFileParams) => Promise<void>;
    verifyASC: (params: IFileParams) => Promise<void>;
    // an exception will be thrown when validation fails.
    verifyAPK: (params: IFileParams) => Promise<void>;
    // verifyAPK will be called by default in the native module when calling to install the APK
    installAPK: (params: IFileParams) => Promise<void>;
    addListener: (eventType: string) => void;
    removeListeners: (count: number) => void;
  };
  BundleUpdateModule: INativeBundleUpdateModule;
  RootViewBackground: {
    setBackground: (r: number, g: number, b: number, a: number) => void;
  };
  WebViewCheckerModule: IWebViewChecker;
};
