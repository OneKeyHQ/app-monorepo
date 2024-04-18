import type { IDownloadPackage, IInstallPackage, IUseDownloadProgress } from './type';

export const downloadPackage: IDownloadPackage = async () => {};

export const installPackage: IInstallPackage = async () => {};

export type * from './type';

export const useDownloadProgress: IUseDownloadProgress = () => 0;
