export type IDownloadAPK = (
  downloadUrl?: string,
  latestVersion?: string,
) => Promise<void>;
export type IInstallAPK = (latestVersion?: string) => Promise<void>;

export type IUseDownloadProgress = (onDownloaded: () => void) => number;
