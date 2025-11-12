import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  IAppleCloudKitAccountInfo,
  IAppleCloudKitNativeModule,
  IAppleCloudKitRecord,
  IAppleCloudKitStorage,
} from './types';

export class AppleCloudKitStorage implements IAppleCloudKitStorage {
  private getCloudKitModule(): IAppleCloudKitNativeModule {
    if (platformEnv.isNativeIOS) {
      const m = NativeModules?.CloudKitModule;
      if (!m) {
        throw new OneKeyLocalError('CloudKit native module not found');
      }
      return m;
    }
    if (platformEnv.isDesktopMac) {
      return desktopApiProxy.cloudKit;
    }
    throw new OneKeyLocalError('Failed to load CloudKit module');
  }

  async getAccountInfo() {
    const cloudKitModule = this.getCloudKitModule();
    return cloudKitModule.getAccountInfo();
  }

  async isAvailable() {
    const cloudKitModule = this.getCloudKitModule();
    return cloudKitModule.isAvailable();
  }

  async saveRecord(params: {
    recordType: string;
    recordID: string;
    data: string;
    meta: string;
  }) {
    const cloudKitModule = this.getCloudKitModule();
    const result = await cloudKitModule.saveRecord(params);
    return result;
  }

  async fetchRecord(params: { recordID: string; recordType: string }) {
    const cloudKitModule = this.getCloudKitModule();
    const result = await cloudKitModule.fetchRecord(params);
    return result;
  }

  async deleteRecord(params: { recordID: string; recordType: string }) {
    const cloudKitModule = this.getCloudKitModule();
    await cloudKitModule.deleteRecord(params);
  }

  async recordExists(params: { recordID: string; recordType: string }) {
    const cloudKitModule = this.getCloudKitModule();
    return cloudKitModule.recordExists(params);
  }

  async queryRecords(params: { recordType: string }) {
    const cloudKitModule = this.getCloudKitModule();
    const result = await cloudKitModule.queryRecords(params);
    return result;
  }
}
