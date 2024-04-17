export type IDownloadAPK = (downloadUrl: string, latestVersion: string) => void;
export type IInstallAPK = (latestVersion: string) => Promise<void>;
