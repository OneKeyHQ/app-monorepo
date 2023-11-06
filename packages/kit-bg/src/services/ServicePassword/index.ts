import {
  decodePassword,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import * as error from '@onekeyhq/shared/src/errors';

import localDb from '../../dbs/local/localDb';
import {
  settingsAtom,
  settingsIsBioAuthEnableAtom,
  settingsIsBioAuthSupportedAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { biologyAuthenticate, getPassword, savePassword } from './bioloygAuth';

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

  validatePasswordStrength(password: string): string {
    const realPassword = decodePassword({ password });
    if (realPassword.length >= 8 && realPassword.length <= 128) {
      return password;
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
    const isSupportBiologyAuth = await settingsIsBioAuthSupportedAtom.get();
    if (isSupportBiologyAuth) {
      await savePassword(password);
    }
  }

  async biologyAuthGetPassword(): Promise<string> {
    const isSupportBiologyAuth = await settingsIsBioAuthSupportedAtom.get();
    if (isSupportBiologyAuth) {
      return getPassword();
    }
    return '';
  }

  async verifyBiologyAuthPassword(): Promise<string> {
    const biologyAuthPassword = await this.biologyAuthGetPassword();
    const verified = await this.validatePassword(biologyAuthPassword);
    if (verified) {
      return biologyAuthPassword;
    }
    return '';
  }

  async validatePassword(
    password: string,
    newPassword?: string,
  ): Promise<boolean> {
    const realPassword = decodePassword({ password });
    const realNewPassword = newPassword
      ? decodePassword({ password: newPassword })
      : undefined;
    this.validatePasswordStrength(password);
    if (realPassword === realNewPassword) {
      throw new error.PasswordUpdateSameFailed();
    }
    return localDb.verifyPassword(password);
  }

  @backgroundMethod()
  async setBiologyAuthEnable(enable: boolean): Promise<void> {
    if (enable) {
      const authRes = await biologyAuthenticate();
      if (!authRes.success) {
        throw new error.BiologyAuthFailed();
      }
    }
    await settingsIsBioAuthEnableAtom.set(enable);
  }

  @backgroundMethod()
  async verifyBiologyAuth(): Promise<string> {
    const authRes = await biologyAuthenticate();
    if (authRes.success) {
      return this.verifyBiologyAuthPassword();
    }
    return '';
  }

  @backgroundMethod()
  async verifyPassword(password: string): Promise<string> {
    const verified = await this.validatePassword(password);
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
    const verified = await this.validatePassword(oldPassword, newPassword);
    if (verified) {
      await this.biologyAuthSavePassword(newPassword);
      await this.saveCachedPassword(newPassword);
      const settings = await settingsAtom.get();
      if (!settings.isPasswordSet) {
        await settingsAtom.set((v) => ({ ...v, isPasswordSet: true }));
      }
      await localDb.updatePassword(oldPassword, newPassword);
      return newPassword;
    }
    throw new error.WrongPassword();
  }

  @backgroundMethod()
  async setPassword(password: string): Promise<string> {
    this.validatePasswordStrength(password);
    const checkPasswordSet = await localDb.checkPasswordSet();
    if (checkPasswordSet) {
      const settings = await settingsAtom.get();
      if (!settings.isPasswordSet) {
        await settingsAtom.set((v) => ({ ...v, isPasswordSet: true }));
      }
      throw new error.PasswordAlreadySetFailed();
    }
    await this.biologyAuthSavePassword(password);
    await this.saveCachedPassword(password);
    await localDb.updatePassword('', password);
    return password;
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }
}
