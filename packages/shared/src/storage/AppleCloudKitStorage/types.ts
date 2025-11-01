export interface IAppleCloudKitRecord {
  recordID: string;
  recordType: string;
  data: string; // base64 encoded encrypted data
  createdAt?: number;
  modifiedAt?: number;
}

export interface IAppleCloudKitNativeModule {
  isAvailable(): Promise<boolean>;
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
