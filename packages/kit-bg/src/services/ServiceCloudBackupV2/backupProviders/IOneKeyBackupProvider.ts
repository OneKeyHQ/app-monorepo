import type {
  IAppleCloudKitRecord,
  ICloudKitAccountStatusName,
} from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type {
  IGoogleDriveFile,
  IGoogleUserInfo,
} from '@onekeyhq/shared/src/storage/GoogleDriveStorage';
import type {
  IPrimeTransferData,
  IPrimeTransferPublicData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

export type IBackupCloudServerData = {
  iCloud?: IAppleCloudKitRecord;
  googleDrive?: IGoogleDriveFile;
};
export type IBackupCloudServerDownloadData = {
  payload: IBackupDataEncryptedPayload;
  content: string;
};
export type IBackupProviderInfo = {
  displayName: string;
  displayNameI18nKey: string;
};
export type IBackupProviderAccountInfo = {
  userId: string;
  iCloud?: {
    cloudKitStatus: number; // CKContainer.AccountStatus raw value
    cloudKitStatusName: ICloudKitAccountStatusName;
    cloudKitContainerUserId: string | null;
    cloudFsAvailable: boolean;
    cloudKitAvailable: boolean;
    keychainCloudSyncEnabled: boolean;
  };
  googleDrive?: {
    email?: string;
    userInfo?: IGoogleUserInfo | null;
    googlePlayServiceAvailable: boolean;
    // cloudFsAvailable?: boolean; // iOS only
  };
};
export type IBackupDataEncryptedPayload = Omit<
  IPrimeTransferData,
  'privateData'
> & {
  privateDataEncrypted: string; // base64 string
};
export type IBackupDataManifestItem = Omit<
  IPrimeTransferPublicData,
  'walletDetails'
> & {
  recordID: string;
  fileName?: string;
};
export type IBackupDataManifest = {
  items: IBackupDataManifestItem[];
  total: number;
};
/**
 * Common interface for all cloud backup providers (iCloud, Google Drive, etc.)
 *
 * Each provider implements platform-specific backup/restore logic while maintaining
 * a consistent API for the ServiceCloudBackupV2 layer.
 */
export interface IOneKeyBackupProvider {
  getBackupProviderInfo(): Promise<IBackupProviderInfo>;

  getCloudAccountInfo(): Promise<IBackupProviderAccountInfo>;

  loginCloudIfNeed(): Promise<void>;

  logoutCloud(): Promise<void>;

  // TODO remove
  isAvailable(): Promise<boolean>;

  /**
   * Check if the cloud service is available on current platform
   * @throws {OneKeyLocalError} if service is not available
   */
  checkAvailability(): Promise<void>;

  /**
   * Prepare or retrieve encryption key for backup
   * @param password Optional user password (required for some providers like Google Drive)
   * @returns Base64-encoded encryption key
   */
  prepareEncryptionKey(params?: { password?: string }): Promise<string>;

  /**
   * Recover encryption key from secure storage or cloud
   * @param password Optional user password (required for some providers like Google Drive)
   * @returns Base64-encoded encryption key or null if not found
   */
  recoverEncryptionKey(params?: { password?: string }): Promise<string | null>;

  // TODO requestSync()

  /**
   * Perform full backup with automatic key management
   * @param password Optional user password (required for some providers like Google Drive)
   * @returns Unique identifier for the backup record
   */
  backupData(
    payload: IBackupDataEncryptedPayload,
  ): Promise<{ recordID: string; content: string }>;

  downloadData(params: {
    recordId: string;
  }): Promise<IBackupCloudServerDownloadData | null>;

  /**
   * Get all available backups from cloud
   * @returns Array of backup records with decrypted data
   */
  getAllBackups(): Promise<IBackupDataManifest>;

  /**
   * Delete a backup from cloud
   * @param params.recordId Unique identifier for the backup record
   */
  deleteBackup(params: { recordId: string }): Promise<void>;
}
