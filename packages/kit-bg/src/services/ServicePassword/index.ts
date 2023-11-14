import {
  decodePassword,
  encodePassword,
  getBgSensitiveTextEncodeKey,
} from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import * as OneKeyError from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';

import localDb from '../../dbs/local/localDb';
import { settingsPersistAtom } from '../../states/jotai/atoms';
import {
  passwordAtom,
  passwordBiologyAuthInfoAtom,
  passwordPersistAtom,
} from '../../states/jotai/atoms/password';
import ServiceBase from '../ServiceBase';
import { checkExtUIOpen } from '../utils';

import {
  deletePassword,
  getPassword,
  savePassword,
} from './bioloygAuthPassword';

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
    throw new OneKeyError.PasswordStrengthValidationFailed();
  }

  async biologyAuthSavePassword(password: string): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (isSupport) {
      await savePassword(password);
    }
  }

  async biologyAuthDeletePassword(): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (isSupport) {
      await deletePassword();
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
      throw new OneKeyError.PasswordUpdateSameFailed();
    }
    return localDb.verifyPassword(password);
  }

  async rollbackPassword(password?: string): Promise<void> {
    if (!password) {
      await this.biologyAuthDeletePassword();
      this.clearCachedPassword();
      await this.setPasswordSetStatus(false);
    } else {
      await this.biologyAuthSavePassword(password);
      await this.setCachedPassword(password);
    }
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
        throw new OneKeyError.BiologyAuthFailed();
      }
    }
    await settingsPersistAtom.set((v) => ({
      ...v,
      isBiologyAuthSwitchOn: enable,
    }));
  }

  @backgroundMethod()
  async setWebAuthEnable(enable: boolean): Promise<void> {
    let webAuthCredentialId: string | undefined;
    if (enable) {
      webAuthCredentialId = await registerWebAuth();
    }
    await passwordPersistAtom.set((v) => ({
      ...v,
      webAuthCredentialId: webAuthCredentialId ?? '',
    }));
  }

  @backgroundMethod()
  async verifyWebAuth(): Promise<string> {
    const { webAuthCredentialId } = await passwordPersistAtom.get();
    if (webAuthCredentialId && this.cachedPassword) {
      const cred = await verifiedWebAuth(webAuthCredentialId);
      if (cred?.id === webAuthCredentialId) {
        return this.cachedPassword;
      }
    }
    return '';
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
      await this.setCachedPassword(password);
      return password;
    }
    return '';
  }

  // check is only done the app open
  @backgroundMethod()
  async checkPasswordSet(): Promise<boolean> {
    const checkPasswordSet = await localDb.checkPasswordSet();
    if (checkPasswordSet) {
      await this.setPasswordSetStatus(checkPasswordSet);
    }
    return checkPasswordSet;
  }

  @backgroundMethod()
  async setPasswordSetStatus(isSet: boolean): Promise<void> {
    await passwordPersistAtom.set((v) => ({ ...v, isPasswordSet: isSet }));
  }

  @backgroundMethod()
  async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<string> {
    const verified = await this.validatePassword(oldPassword, newPassword);
    if (verified) {
      await this.biologyAuthSavePassword(newPassword);
      await this.setCachedPassword(newPassword);
      await this.setPasswordSetStatus(true);
      await localDb.updatePassword(oldPassword, newPassword);
      return newPassword;
    }
    throw new OneKeyError.WrongPassword();
  }

  @backgroundMethod()
  async setPassword(password: string): Promise<string> {
    this.validatePasswordStrength(password);
    await this.biologyAuthSavePassword(password);
    await this.setCachedPassword(password);
    await this.setPasswordSetStatus(true);
    await localDb.updatePassword('', password);
    return password;
  }

  @backgroundMethod()
  async promptPasswordVerify() {
    // check ext ui open
    if (platformEnv.isExtension && !checkExtUIOpen()) {
      throw new OneKeyError.OneKeyInternalError();
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
      void this.showPasswordPromptDialog(promiseId);
    });
  }

  @backgroundMethod()
  async showPasswordPromptDialog(promiseId: number) {
    await passwordAtom.set((v) => ({
      ...v,
      passwordPromptPromiseId: promiseId,
    }));
  }

  @backgroundMethod()
  async resolvePasswordPromptDialog(promiseId: number, data: IPasswordRes) {
    this.backgroundApi.servicePromise.resolveCallback({ id: promiseId, data });
  }

  @backgroundMethod()
  async rejectPasswordPromptDialog(
    promiseId: number,
    error: { message: string },
  ) {
    this.backgroundApi.servicePromise.rejectCallback({ id: promiseId, error });
  }

  @backgroundMethod()
  async unLockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: true }));
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }
}
