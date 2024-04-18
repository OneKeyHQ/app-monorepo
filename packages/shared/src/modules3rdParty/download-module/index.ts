import type { IDownloadAPK, IInstallAPK, IUseDownloadProgress } from './type';

export const downloadAPK: IDownloadAPK = async () => {};

export const installAPK: IInstallAPK = async () => {};

export type * from './type';

export const useDownloadProgress: IUseDownloadProgress = () => 0;
