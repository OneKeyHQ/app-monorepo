export type IDownloadAPK = (
  downloadUrl?: string,
  latestVersion?: string,
) => Promise<void>;
export type IInstallAPK = (latestVersion?: string) => Promise<void>;

export type IUseDownloadProgress = (
  onSuccess: () => void,
  onFailed: (params: { message: string }) => void,
) => number;
