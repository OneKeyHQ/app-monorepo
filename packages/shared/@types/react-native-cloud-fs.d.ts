declare module 'react-native-cloud-fs' {
  interface IRNCloudFS {
    isAvailable(): Promise<boolean>;
    syncCloud(): Promise<boolean>;
    listFiles(options: { scope: string; targetPath: string }): Promise;
    deleteFromCloud(item: any): Promise;
    copyToCloud(options: {
      mimeType: string | null;
      scope: string;
      sourcePath: { path: string };
      targetPath: string;
    }): Promise;
    getIcloudDocument(string): Promise<string>;
  }
  export const RNCloudFs: IRNCloudFS;
  export default RNCloudFs;
}
