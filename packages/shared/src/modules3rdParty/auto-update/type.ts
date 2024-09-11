import type { IAppUpdateInfo } from '../../appUpdate';

export type IUpdateDownloadedEvent = {
  downloadedFile: string;
  latestVersion?: string;
  downloadUrl?: string;
};

export type IDownloadPackage = (params: {
  downloadUrl?: string;
  latestVersion?: string;
}) => Promise<IUpdateDownloadedEvent>;

export type IVerifyPackage = (params: IUpdateDownloadedEvent) => Promise<void>;

export type IInstallPackage = (params: IAppUpdateInfo) => Promise<void>;

export type IUseDownloadProgress = (
  onSuccess: () => void,
  onFailed: (params: { message: string }) => void,
) => number;

export type IClearPackage = () => Promise<void>;
