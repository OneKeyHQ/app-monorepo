import type {
  IClearPackage,
  IDownloadPackage,
  IInstallPackage,
  IUpdateDownloadedEvent,
  IUseDownloadProgress,
  IVerifyPackage,
} from './type';

export const downloadPackage: IDownloadPackage = async () =>
  ({} as IUpdateDownloadedEvent);

export const verifyPackage: IVerifyPackage = async () => {};

export const installPackage: IInstallPackage = async () => {};

export type * from './type';

export const useDownloadProgress: IUseDownloadProgress = () => 0;

export const clearPackage: IClearPackage = () => Promise.resolve();
