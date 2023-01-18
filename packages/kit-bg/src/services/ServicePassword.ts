import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private data?: string;

  getRandomString() {
    return generateUUID();
  }

  clearData() {
    this.data = undefined;
  }

  async setData(password: string): Promise<string> {
    const key = this.getRandomString();
    const data = encrypt(key, Buffer.from(password, 'utf-8')).toString('hex');
    await simpleDb.pwkey.setRawData({ key });
    this.data = data;
    return data;
  }

  @backgroundMethod()
  encryptByInstanceId(data: string): Promise<string> {
    const { appSelector } = this.backgroundApi;
    const { instanceId } = appSelector((s) => s.settings);
    const text = encrypt(instanceId, Buffer.from(data, 'utf-8')).toString(
      'hex',
    );
    return Promise.resolve(text);
  }

  @backgroundMethod()
  decryptByInstanceId(text: string): Promise<string> {
    const { appSelector } = this.backgroundApi;
    const { instanceId } = appSelector((s) => s.settings);
    const data = decrypt(instanceId, Buffer.from(text, 'hex')).toString(
      'utf-8',
    );
    return Promise.resolve(data);
  }

  async getData(ttl?: number): Promise<string | undefined> {
    if (!this.data) {
      return undefined;
    }
    const keyData = await simpleDb.pwkey.getRawData();
    const { updatedAt } = simpleDb.pwkey;
    if (!keyData || !keyData.key) {
      return undefined;
    }
    let data: string | undefined;
    try {
      data = decrypt(keyData.key, Buffer.from(this.data, 'hex')).toString(
        'utf-8',
      );
    } catch {
      return undefined;
    }
    if (!ttl || Number.isNaN(ttl)) {
      return data;
    }
    const now = Date.now();
    return now - updatedAt <= ttl ? data : undefined;
  }

  @backgroundMethod()
  async verifyPassword(password: string): Promise<boolean> {
    const { engine } = this.backgroundApi;
    return engine.verifyMasterPassword(password);
  }

  @backgroundMethod()
  async savePassword(password: string): Promise<void> {
    const isOk = await this.verifyPassword(password);
    if (isOk) {
      await this.setData(password);
      appEventBus.emit(AppEventBusNames.BackupRequired);
    }
  }

  @backgroundMethod()
  async getPassword() {
    const { appSelector } = this.backgroundApi;
    const enableAppLock = appSelector((s) => s.settings.enableAppLock);
    const ttl = !enableAppLock ? 240 * 60 * 1000 : undefined;
    return this.getPasswordWithTTL(ttl);
  }

  async getPasswordWithTTL(ttl?: number): Promise<string | undefined> {
    const data = await this.getData(ttl);
    if (!data) {
      return undefined;
    }
    const isOk = await this.verifyPassword(data);
    return isOk ? data : undefined;
  }
}
