import {
  decodePassword,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import {
  getPassword,
  hasHardwareSupported,
  localAuthenticate,
  savePassword,
} from '@onekeyhq/kit/src/components/BioloygAuth';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import * as error from '@onekeyhq/shared/src/errors';

import localDb from '../dbs/local/localDb';
import { settingsAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private cachedPassword?: string;

  clearCachedPassword() {
    this.cachedPassword = undefined;
  }

  async setCachedPassword(password: string): Promise<string> {
    this.cachedPassword = password;
    return password;
  }

  async getCachedPassword(): Promise<string | undefined> {
    if (!this.cachedPassword) {
      return undefined;
    }
    return this.cachedPassword;
  }

  async validatePasswordStrength(password: string): Promise<string> {
    const realPassword = decodePassword({ password });
    if (realPassword.length >= 8 && realPassword.length <= 128) {
      return Promise.resolve(password);
    }
    throw new error.PasswordStrengthValidationFailed();
  }

  async saveCachedPassword(password: string): Promise<void> {
    const checkResult = await this.verifyPassword(password);
    if (checkResult) {
      await this.setCachedPassword(password);
    }
  }

  async biologyAuthSavePassword(password: string): Promise<void> {
    const isSupportBiologyAuth = await hasHardwareSupported();
    if (isSupportBiologyAuth) {
      await savePassword(password);
    }
  }

  async biologyAuthGetPassword(): Promise<string> {
    const isSupportBiologyAuth = await hasHardwareSupported();
    if (isSupportBiologyAuth) {
      return getPassword();
    }
    return '';
  }

  async verifyBiologyAuthPassword(): Promise<string> {
    const biologyAuthPassword = await this.biologyAuthGetPassword();
    const verified = await this.verifyPassword(biologyAuthPassword);
    if (verified) {
      return biologyAuthPassword;
    }
    return '';
  }

  @backgroundMethod()
  async verifyBiologyAuth(): Promise<string> {
    const authRes = await localAuthenticate();
    if (authRes.success) {
      return this.verifyBiologyAuthPassword();
    }
    return '';
  }

  @backgroundMethod()
  async verifyPassword(password: string): Promise<string> {
    const verified = await localDb.verifyPassword(password);
    if (verified) {
      return password;
    }
    return '';
  }

  @backgroundMethod()
  async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<string> {
    const verified = await this.verifyPassword(oldPassword);
    if (verified) {
      await this.validatePasswordStrength(newPassword);
      await localDb.updatePassword(newPassword);
      await this.biologyAuthSavePassword(newPassword);
      await this.saveCachedPassword(newPassword);
      const settings = await settingsAtom.get();
      if (!settings.isPasswordSet) {
        await settingsAtom.set((v) => ({ ...v, isPasswordSet: true }));
      }
      return newPassword;
    }
    throw new error.WrongPassword();
  }

  @backgroundMethod()
  async setPassword(password: string): Promise<string> {
    await this.validatePasswordStrength(password);
    await localDb.updatePassword(password);
    await this.biologyAuthSavePassword(password);
    await this.saveCachedPassword(password);
    const settings = await settingsAtom.get();
    if (!settings.isPasswordSet) {
      await settingsAtom.set((v) => ({ ...v, isPasswordSet: true }));
    }
    return password;
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }
}
