export interface IAppleCloudKitRecord {
  recordID: string;
  recordType: string;
  data: string; // JSON parsed IBackupDataEncryptedPayload
  createdAt?: number;
  modifiedAt?: number;
}

export interface IAppleCloudKitNativeModule {
  isAvailable(): Promise<boolean>;
  getAccountInfo(): Promise<IAppleCloudKitAccountInfo>;
  saveRecord(params: {
    recordType: string;
    recordID: string;
    data: string;
  }): Promise<{ recordID: string; createdAt: number }>;
  fetchRecord(params: {
    recordID: string;
    recordType: string;
  }): Promise<IAppleCloudKitRecord | null>;
  deleteRecord(params: { recordID: string; recordType: string }): Promise<void>;
  recordExists(params: {
    recordID: string;
    recordType: string;
  }): Promise<boolean>;
  queryRecords(params: {
    recordType: string;
  }): Promise<{ records: IAppleCloudKitRecord[] }>;
}

export type IAppleCloudKitStorage = IAppleCloudKitNativeModule;

export type ICloudKitAccountStatusName =
  | 'couldNotDetermine' /* 0 */
  | 'available' /* 1 */
  | 'restricted' /* 2 */
  | 'noAccount' /* 3 */;

export interface IAppleCloudKitAccountInfo {
  status: number; // CKContainer.AccountStatus raw value
  statusName: ICloudKitAccountStatusName;
  containerUserId: string | null;
}
