import type {
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
  IBackupDataManifest,
  IBackupProviderAccountInfo,
  IBackupProviderInfo,
  ICloudBackupKeylessWalletPayload,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';

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

  setBackupPassword(params?: {
    password?: string;
  }): Promise<{ recordID: string }>;

  verifyBackupPassword(params?: { password?: string }): Promise<boolean>;

  isBackupPasswordSet(): Promise<boolean>;

  clearBackupPassword(): Promise<void>;

  /**
   * Perform full backup with automatic key management
   * @param password Optional user password (required for some providers like Google Drive)
   * @returns Unique identifier for the backup record
   */
  backupData(
    payload: IBackupDataEncryptedPayload,
  ): Promise<{ recordID: string; content: string }>;

  backupKeylessWalletData(
    payload: ICloudBackupKeylessWalletPayload,
  ): Promise<{ recordID: string; content: string; meta: string }>;

  downloadKeylessWalletData(params: { recordID: string }): Promise<{
    payload: ICloudBackupKeylessWalletPayload;
    content: string;
  } | null>;

  getKeylessWalletBackupRecordID(params: {
    packSetId: string;
  }): Promise<{ recordID: string; packSetId: string } | null>;

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
  deleteBackup(params: {
    recordId: string;
    skipManifestUpdate?: boolean;
  }): Promise<void>;
}
