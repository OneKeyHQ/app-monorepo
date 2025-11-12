import {
  cloudkitDeleteRecord,
  cloudkitFetchRecord,
  cloudkitGetAccountInfo,
  cloudkitIsAvailable,
  cloudkitQueryRecords,
  cloudkitRecordExists,
  cloudkitSaveRecord,
} from '@onekeyfe/electron-mac-icloud';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IAppleCloudKitAccountInfo,
  IAppleCloudKitStorage,
  ICloudKitAccountStatusName,
} from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';

import type { IDesktopApi } from './instance/IDesktopApi';

export type ICloudKitRecord = {
  recordID: string;
  recordType: string;
  data: string;
  meta: string;
  createdAt: number;
  modifiedAt: number;
};

export type ICloudKitSaveRecordParams = {
  recordType: string;
  recordID: string;
  data: string;
  meta: string;
};

export type ICloudKitSaveRecordResult = {
  recordID: string;
  createdAt: number;
};

export type ICloudKitFetchRecordParams = {
  recordID: string;
  recordType: string;
};

export type ICloudKitDeleteRecordParams = {
  recordID: string;
  recordType: string;
};

export type ICloudKitRecordExistsParams = {
  recordID: string;
  recordType: string;
};

export type ICloudKitQueryRecordsParams = {
  recordType: string;
};

export type ICloudKitQueryRecordsResult = {
  records: ICloudKitRecord[];
};

class DesktopApiCloudKit implements IAppleCloudKitStorage {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  ensureMacOS() {
    if (process.platform !== 'darwin') {
      throw new OneKeyLocalError('CloudKit is only available on macOS');
    }
  }

  async getAccountInfo(): Promise<IAppleCloudKitAccountInfo> {
    this.ensureMacOS();
    const accountInfo = await cloudkitGetAccountInfo();

    return {
      ...accountInfo,
      statusName: accountInfo.statusName as ICloudKitAccountStatusName,
      containerUserId: accountInfo.containerUserId ?? null,
    };
  }

  async isAvailable(): Promise<boolean> {
    this.ensureMacOS();
    return cloudkitIsAvailable();
  }

  async saveRecord(
    params: ICloudKitSaveRecordParams,
  ): Promise<ICloudKitSaveRecordResult> {
    this.ensureMacOS();

    return cloudkitSaveRecord(params);
  }

  async fetchRecord(
    params: ICloudKitFetchRecordParams,
  ): Promise<ICloudKitRecord | null> {
    this.ensureMacOS();
    return cloudkitFetchRecord(params);
  }

  async deleteRecord(params: ICloudKitDeleteRecordParams): Promise<void> {
    this.ensureMacOS();
    return cloudkitDeleteRecord(params);
  }

  async recordExists(params: ICloudKitRecordExistsParams): Promise<boolean> {
    this.ensureMacOS();
    return cloudkitRecordExists(params);
  }

  async queryRecords(
    params: ICloudKitQueryRecordsParams,
  ): Promise<ICloudKitQueryRecordsResult> {
    this.ensureMacOS();
    return cloudkitQueryRecords(params);
  }
}

export default DesktopApiCloudKit;
