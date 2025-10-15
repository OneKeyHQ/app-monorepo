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
  getWebEmbedPath: () => Promise.resolve(''),
  downloadBundle: () => Promise.resolve({} as IUpdateDownloadedEvent),
  verifyBundle: () => Promise.resolve(),
  verifyBundleASC: () => Promise.resolve(),
  downloadBundleASC: () => Promise.resolve(),
  installBundle: () => Promise.resolve(),
  clearBundle: () => Promise.resolve(),
  clearAllJSBundleData: () =>
    Promise.resolve({ success: false, message: 'Not supported on web' }),
  testVerification: () => Promise.resolve(false),
  testDeleteJsBundle: () =>
    Promise.resolve({ success: false, message: 'Not supported on web' }),
  testDeleteJsRuntimeDir: () =>
    Promise.resolve({ success: false, message: 'Not supported on web' }),
  testDeleteMetadataJson: () =>
    Promise.resolve({ success: false, message: 'Not supported on web' }),
  testWriteEmptyMetadataJson: () =>
    Promise.resolve({ success: false, message: 'Not supported on web' }),
  getFallbackBundles: () => Promise.resolve([]),
  switchBundle: () => Promise.resolve(),
};

export const useDownloadProgress: IUseDownloadProgress = () => 0;
export type * from './type';
