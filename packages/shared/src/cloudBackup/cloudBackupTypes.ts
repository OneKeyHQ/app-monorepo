import { ICloudKeyPackEncryptedData } from '../keylessWallet/keylessWalletTypes';

import type {
  IPrimeTransferData,
  IPrimeTransferPublicData,
} from '../../types/prime/primeTransferTypes';
import type { ICloudKeyPack } from '../keylessWallet/keylessWalletTypes';
import type {
  IAppleCloudKitRecord,
  ICloudKitAccountStatusName,
} from '../storage/AppleCloudKitStorage/types';
import type {
  IGoogleDriveFile,
  IGoogleUserInfo,
} from '../storage/GoogleDriveStorage';

export enum ECloudBackupProviderType {
  iCloud = 'iCloud',
  GoogleDrive = 'GoogleDrive',
}

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
  userEmail: string;
  providerType: ECloudBackupProviderType;
  iCloud?: {
    cloudKitStatus: number; // CKContainer.AccountStatus raw value
    cloudKitStatusName: ICloudKitAccountStatusName;
    cloudKitContainerUserId: string | null;
    cloudFsAvailable: boolean | undefined;
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

export type ICloudBackupKeylessWalletPayload = {
  cloudKeyPack: ICloudKeyPack;
};

export type IBackupDataManifestItem = Omit<
  IPrimeTransferPublicData,
  'walletDetails'
> & {
  recordID: string;
  fileName?: string;
};

export type IBackupDataManifest = {
  keylessWallets?: {
    [packSetId: string]: {
      recordID: string;
      fileName: string;
    };
  };
  items: IBackupDataManifestItem[];
  total: number;
  backupPasswordVerify?: IBackupDataPasswordVerify;
  googleDriveLegacyMetaDataFileId?: string;
};

export type IBackupDataPasswordVerify = {
  content: string; // encryptStringAsync(CLOUD_BACKUP_PASSWORD_VERIFY_TEXT, password)
};
