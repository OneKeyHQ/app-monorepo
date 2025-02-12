import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBAppStatus {
  isInitialized: boolean;
  lastUpdateTime: number;
  appVersion: string;
  deviceId: string;
  isFirstOpen: boolean;
}

export class SimpleDbEntityAppStatus extends SimpleDbEntityBase<ISimpleDBAppStatus> {
  entityName = 'app-status';

  override enableCache = true;

  async getAppStatus(): Promise<ISimpleDBAppStatus | null> {
    return this.getRawData();
  }

  @backgroundMethod()
  async updateAppStatus(status: Partial<ISimpleDBAppStatus>) {
    await this.setRawData((prev) => ({
      ...prev,
      ...status,
      lastUpdateTime: Date.now(),
    }));
  }

  @backgroundMethod()
  async setInitialized(isInitialized: boolean) {
    await this.updateAppStatus({ isInitialized });
  }

  @backgroundMethod()
  async setAppVersion(version: string) {
    await this.updateAppStatus({ appVersion: version });
  }

  @backgroundMethod()
  async setDeviceId(deviceId: string) {
    await this.updateAppStatus({ deviceId });
  }

  @backgroundMethod()
  async setFirstOpenStatus(isFirstOpen: boolean) {
    await this.updateAppStatus({ isFirstOpen });
  }
} 