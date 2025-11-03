import type {
  IAppleCloudKitAccountInfo,
  IAppleCloudKitRecord,
  ICloudKitAccountStatusName,
} from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type { IGoogleDriveFile } from '@onekeyhq/shared/src/storage/GoogleDriveStorage';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

export type IBackupProviderInfo = {
  displayName: string;
  displayNameI18nKey: string;
};
export type IBackupProviderAccountInfo = {
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
    googlePlayServiceAvailable: boolean;
  };
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

  /**
   * Get the backup data to be encrypted and stored
   * @returns Transfer data containing all wallet information
   */
  getBackupData(): Promise<IPrimeTransferData>;
  // TODO buildBackupData(): Promise<IPrimeTransferData>;

  // TODO requestSync()

  /**
   * Perform full backup with automatic key management
   * @param password Optional user password (required for some providers like Google Drive)
   * @returns Unique identifier for the backup record
   */
  backupData(params?: {
    password?: string;
  }): Promise<{ recordID: string; content: string }>;

  /**
   * Perform backup using provided encryption key
   * @param encryptionKey Base64-encoded encryption key
   * @returns Unique identifier for the backup record
   */
  backupDataWithEncryptionKey(
    encryptionKey: string,
  ): Promise<{ recordID: string; content: string }>;

  /**
   * Restore backup data from cloud
   * @param params.recordId Unique identifier for the backup record
   * @param params.password Optional user password (required for some providers like Google Drive)
   * @returns Decrypted backup data or null if not found
   */
  restoreData(params: {
    recordId: string;
    password?: string;
  }): Promise<IPrimeTransferData | null>;

  downloadData(params: {
    recordId: string;
  }): Promise<IAppleCloudKitRecord | IGoogleDriveFile | null>;

  /**
   * Get all available backups from cloud
   * @returns Array of backup records with decrypted data
   */
  getAllBackups(): Promise<
    Array<{
      record: IAppleCloudKitRecord | IGoogleDriveFile;
      backupData: IPrimeTransferData | null;
    }>
  >;

  /**
   * Delete a backup from cloud
   * @param params.recordId Unique identifier for the backup record
   */
  deleteBackup(params: { recordId: string }): Promise<void>;
}
