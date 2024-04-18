export type IDownloadPackage = (params: {
  downloadUrl?: string;
  latestVersion?: string;
  sha256?: string;
}) => Promise<void>;
export type IInstallPackage = (params: {
  latestVersion?: string;
  sha256?: string;
}) => Promise<void>;

export type IUseDownloadProgress = (
  onSuccess: () => void,
  onFailed: (params: { message: string }) => void,
) => number;
