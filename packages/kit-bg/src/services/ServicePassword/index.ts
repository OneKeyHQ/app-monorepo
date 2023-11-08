import {
  decodePassword,
  encodePassword,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import * as error from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import localDb from '../../dbs/local/localDb';
import { settingsAtom } from '../../states/jotai/atoms';
import {
  passwordBiologyAuthInfoAtom,
  passwordPromptPromiseAtom,
} from '../../states/jotai/atoms/password';
import ServiceBase from '../ServiceBase';
import { checkExtUIOpen } from '../utils';

import { getPassword, savePassword } from './bioloygAuthPassword';

interface IPasswordResData {
  password: string;
}

export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  PASS_STATUS = 'pass',
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  data: IPasswordResData;
}
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
    const checkResult = await this.validatePassword(password);
    if (checkResult) {
      await this.setCachedPassword(password);
    }
  }

  async biologyAuthSavePassword(password: string): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (isSupport) {
      await savePassword(password);
    }
  }

  async biologyAuthGetPassword(): Promise<string> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (isSupport) {
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
  async encodeSensitivePassword(password: string): Promise<string> {
    return Promise.resolve(encodePassword({ password }));
  }

  @backgroundMethod()
  async setBiologyAuthEnable(enable: boolean): Promise<void> {
    if (enable) {
      const authRes = await biologyAuth.biologyAuthenticate();
      if (!authRes.success) {
        throw new error.BiologyAuthFailed();
      }
    }
    await settingsAtom.set((v) => ({
      ...v,
      isBiologyAuthSwitchOn: enable,
    }));
  }

  @backgroundMethod()
  async verifyBiologyAuth(): Promise<string> {
    const authRes = await biologyAuth.biologyAuthenticate();
    if (authRes.success) {
      return this.verifyBiologyAuthPassword();
    }
    return '';
  }

  @backgroundMethod()
  async verifyPassword(password: string): Promise<string> {
    const verified = await this.validatePassword(password);
    if (verified) {
      await this.saveCachedPassword(password);
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
  async promptPasswordVerify() {
    // check ext ui open
    if (platformEnv.isExtension && !checkExtUIOpen()) {
      throw new error.OneKeyInternalError();
    }

    // TODO check field(settings protection)
    const cachedPassword = await this.getCachedPassword();
    if (cachedPassword) {
      return Promise.resolve({
        status: EPasswordResStatus.PASS_STATUS,
        data: { password: cachedPassword },
      });
    }

    return new Promise((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      void passwordPromptPromiseAtom.set({ promiseId });
    });
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }
}
