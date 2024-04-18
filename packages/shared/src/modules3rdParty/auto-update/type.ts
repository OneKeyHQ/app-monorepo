export type IDownloadPackage = (
  downloadUrl?: string,
  latestVersion?: string,
) => Promise<void>;
export type IInstallPackage = (latestVersion?: string) => Promise<void>;

export type IUseDownloadProgress = (
  onSuccess: () => void,
  onFailed: (params: { message: string }) => void,
) => number;
