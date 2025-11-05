declare module 'react-native-cloud-fs' {
  interface IRNCloudFS {
    loginIfNeeded(): Promise<boolean>;
    logout(): Promise<boolean>;
    isAvailable(): Promise<boolean>;
    syncCloud(): Promise<boolean>;

    /** Android: list files (hidden uses appDataFolder, visible uses user-visible folder) */
    listFiles(options: {
      scope?: 'hidden' | 'visible';
      targetPath?: string; // iOS Only?
    }): Promise<{
      files: Array<{
        id: string;
        name: string;
        lastModified: string;
        isFile?: boolean; // iOS Only?
      }>;
    }>;
    /** Android: delete a Drive file by id */
    deleteFromCloud(item: { id: string }): Promise<boolean>;
    /** Android: check if a Drive file exists by id */
    fileExists(options: { fileId: string }): Promise<boolean>;
    /** Android: upload a file to Drive */
    copyToCloud(options: {
      mimetype?: string | null; // Android only
      scope?: 'hidden' | 'visible';
      sourcePath: { path?: string; uri?: string };
      targetPath: string;
    }): Promise<string>;
    /** iOS */
    getIcloudDocument(fileId: string): Promise<string>;
    /** Android */
    getGoogleDriveDocument(fileId: string): Promise<string>;
    /** Android: trigger Google sign-in UI */
    requestSignIn(): void;
    /** Android: current Google account basic profile, or null if not signed in */
    getCurrentlySignedInUserData(): Promise<{
      email: string;
      name: string;
      avatarUrl: string | null;
    } | null>;
  }
  export const RNCloudFs: IRNCloudFS;
  export default RNCloudFs;
}
