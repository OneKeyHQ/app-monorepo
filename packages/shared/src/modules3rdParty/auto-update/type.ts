import type { IAppUpdateInfo } from '../../appUpdate';
import type { IDesktopEventUnSubscribe } from '@onekeyhq/desktop/app/preload';
import type { IUpdateProgressUpdate } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiUpdate';

export type IUpdateDownloadedEvent = {
  downloadedFile?: string;
  latestVersion?: string;
  downloadUrl?: string;
};

export type IDownloadPackage = (params: {
  downloadUrl?: string;
  latestVersion?: string;
}) => Promise<IUpdateDownloadedEvent>;

export type IInstallPackage = (params: IAppUpdateInfo) => Promise<void>;

export type IDownloadASC = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IVerifyASC = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IVerifyPackage = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IUseDownloadProgress = (
  onSuccess: () => void,
  onFailed: (params: { message: string }) => void,
) => number;

export type IClearPackage = () => Promise<void>;

export type IManualInstallPackage = (
  params: IUpdateDownloadedEvent & { buildNumber: string },
) => Promise<void>;

export type IElectronUpdateListeners = {
  onProgressUpdate?: (callback: (params: IUpdateProgressUpdate) => void) => IDesktopEventUnSubscribe | undefined;
  onDownloaded?: (callback: (params: IUpdateDownloadedEvent) => void) => IDesktopEventUnSubscribe | undefined;
  onUpdateError?: (callback: (params: { message: string }) => void) => IDesktopEventUnSubscribe | undefined;
  onDownloadedFileEvent?: (callback: (fileUrl: string) => void) => IDesktopEventUnSubscribe | undefined;
};\