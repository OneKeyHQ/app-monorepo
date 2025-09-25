import type { IDesktopEventUnSubscribe } from '@onekeyhq/desktop/app/preload';
import type { IUpdateProgressUpdate } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiAppUpdate';

import type { IAppUpdateInfo } from '../../appUpdate';

export interface IDownloadPackageParams {
  downloadUrl?: string;
  latestVersion?: string;
  bundleVersion?: string;
  fileSize?: number;
  sha256?: string;
  signature?: string;
  downloadedFile?: string;
}

export type IUpdateDownloadedEvent =
  | (IDownloadPackageParams & {
      downloadedFile?: string;
      signature?: string;
    })
  | undefined;

export type IDownloadPackage = (
  params: IDownloadPackageParams,
) => Promise<IUpdateDownloadedEvent>;

export type IInstallPackage = (params: IAppUpdateInfo) => Promise<void>;

export type IDownloadASC = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IVerifyASC = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IVerifyPackage = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IUseDownloadProgress = () => number;

export type IClearPackage = () => Promise<void>;

export type IManualInstallPackage = (
  params: IUpdateDownloadedEvent & { buildNumber: string },
) => Promise<void>;

export interface IAppUpdate {
  downloadPackage: IDownloadPackage;
  verifyPackage: IVerifyPackage;
  verifyASC: IVerifyASC;
  downloadASC: IDownloadASC;
  installPackage: IInstallPackage;
  manualInstallPackage: IManualInstallPackage;
  clearPackage: IClearPackage;
}

export type IElectronUpdateListeners = {
  onProgressUpdate?: (
    callback: (params: IUpdateProgressUpdate) => void,
  ) => IDesktopEventUnSubscribe | undefined;
  onDownloaded?: (
    callback: (params: IUpdateDownloadedEvent) => void,
  ) => IDesktopEventUnSubscribe | undefined;
  onUpdateError?: (
    callback: (params: { message: string }) => void,
  ) => IDesktopEventUnSubscribe | undefined;
  onDownloadedFileEvent?: (
    callback: (fileUrl: string) => void,
  ) => IDesktopEventUnSubscribe | undefined;
};

export type IDownloadBundle = (
  params: IDownloadPackageParams,
) => Promise<IUpdateDownloadedEvent>;

export type IBundleUpdateDownloadedEvent = {
  downloadedFile?: string;
  latestVersion?: string;
  downloadUrl?: string;
};

export type IVerifyBundle = (params: IUpdateDownloadedEvent) => Promise<void>;
export type IVerifyBundleASC = (
  params: IUpdateDownloadedEvent,
) => Promise<void>;
export type IDownloadBundleASC = (
  params: IUpdateDownloadedEvent,
) => Promise<void>;
export type IInstallBundle = (params: IUpdateDownloadedEvent) => Promise<void>;
export type IClearBundle = () => Promise<void>;

export type ITestDeleteJsBundle = (
  appVersion: string,
  bundleVersion: string,
) => Promise<{ success: boolean; message: string }>;
export type ITestDeleteJsRuntimeDir = (
  appVersion: string,
  bundleVersion: string,
) => Promise<{ success: boolean; message: string }>;
export type ITestDeleteMetadataJson = (
  appVersion: string,
  bundleVersion: string,
) => Promise<{ success: boolean; message: string }>;
export type ITestWriteEmptyMetadataJson = (
  appVersion: string,
  bundleVersion: string,
) => Promise<{ success: boolean; message: string }>;

export interface IBundleUpdate {
  downloadBundle: IDownloadBundle;
  verifyBundle: IVerifyBundle;
  verifyBundleASC: IVerifyBundleASC;
  downloadBundleASC: IDownloadBundleASC;
  installBundle: IInstallBundle;
  clearBundle: IClearBundle;
  clearAllJSBundleData: () => Promise<void>;
  testVerification: () => Promise<boolean>;
  testDeleteJsBundle: ITestDeleteJsBundle;
  testDeleteJsRuntimeDir: ITestDeleteJsRuntimeDir;
  testDeleteMetadataJson: ITestDeleteMetadataJson;
  testWriteEmptyMetadataJson: ITestWriteEmptyMetadataJson;
}
