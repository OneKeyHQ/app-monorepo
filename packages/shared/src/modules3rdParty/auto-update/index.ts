import type {
  IClearPackage,
  IDownloadASC,
  IDownloadPackage,
  IInstallPackage,
  IManualInstallPackage,
  IUpdateDownloadedEvent,
  IUseDownloadProgress,
  IVerifyASC,
  IVerifyPackage,
} from './type';

export const downloadPackage: IDownloadPackage = async () =>
  ({} as IUpdateDownloadedEvent);

export const downloadASC: IDownloadASC = async () => Promise.resolve();

export const verifyASC: IVerifyASC = async () => Promise.resolve();

export const verifyPackage: IVerifyPackage = async () => Promise.resolve();

export const installPackage: IInstallPackage = async () => Promise.resolve();

export type * from './type';

export const useDownloadProgress: IUseDownloadProgress = () => 0;

export const clearPackage: IClearPackage = () => Promise.resolve();

export const manualInstallPackage: IManualInstallPackage = () =>
  Promise.resolve();
