import type {
  IAppUpdate,
  IBundleUpdate,
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

const downloadPackage: IDownloadPackage = async () =>
  ({} as IUpdateDownloadedEvent);

const downloadASC: IDownloadASC = async () => Promise.resolve();

const verifyASC: IVerifyASC = async () => Promise.resolve();

const verifyPackage: IVerifyPackage = async () => Promise.resolve();

const installPackage: IInstallPackage = async () => Promise.resolve();

const clearPackage: IClearPackage = () => Promise.resolve();

const manualInstallPackage: IManualInstallPackage = () => Promise.resolve();

export const AppUpdate: IAppUpdate = {
  downloadPackage,
  verifyPackage,
  verifyASC,
  downloadASC,
  installPackage,
  manualInstallPackage,
  clearPackage,
};

export const BundleUpdate: IBundleUpdate = {
  downloadBundle: () => Promise.resolve({} as IUpdateDownloadedEvent),
  verifyBundle: () => Promise.resolve(),
  verifyBundleASC: () => Promise.resolve(),
  downloadBundleASC: () => Promise.resolve(),
  installBundle: () => Promise.resolve(),
  clearBundle: () => Promise.resolve(),
  testVerification: () => Promise.resolve(false),
};

export const useDownloadProgress: IUseDownloadProgress = () => 0;
export type * from './type';
