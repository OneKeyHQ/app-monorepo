import {
  decodePassword,
  encodePassword,
  getBgSensitiveTextEncodeKey,
  isEncodedSensitiveText,
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

export enum EPasswordResStatus {
  CLOSE_STATUS = 'close',
  PASS_STATUS = 'pass',
}
export interface IPasswordRes {
  status: EPasswordResStatus;
  password: string;
}
@backgroundClass()
export default class ServicePassword extends ServiceBase {
  // cachePassword ------------------------------
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

  // biologyAuth&WebAuth ------------------------------
  async biologyAuthSavePassword(password: string): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (!isSupport) {
      throw new Error('biology is not support');
    }
    await savePassword(password);
  }

  async biologyAuthDeletePassword(): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (!isSupport) {
      throw new Error('biology is not support');
    }
    await deletePassword();
  }

  async biologyAuthGetPassword(): Promise<string> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (!isSupport) {
      throw new Error('biology is not support');
    }
    return getPassword();
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
    throw new OneKeyError.BiologyAuthFailed();
  }

  // validatePassword --------------------------------
  validatePasswordStrength(password: string): string {
    const realPassword = decodePassword({ password });
    if (realPassword.length >= 8 && realPassword.length <= 128) {
      return password;
    }
    throw new OneKeyError.PasswordStrengthValidationFailed();
  }

  validatePasswordSame(password: string, newPassword: string) {
    const realPassword = decodePassword({ password });
    const realNewPassword = decodePassword({ password: newPassword });
    if (realPassword === realNewPassword) {
      throw new OneKeyError.PasswordUpdateSameFailed();
    }
  }

  async validatePassword({
    password,
    newPassword,
    skipDBVerify,
  }: {
    password: string;
    newPassword?: string;
    skipDBVerify?: boolean;
  }): Promise<void> {
    if (
      !isEncodedSensitiveText(password) ||
      (newPassword && !isEncodedSensitiveText(newPassword))
    ) {
      throw new Error('Passing raw password is not allowed and not safe.');
    }
    this.validatePasswordStrength(password);
    if (newPassword) {
      this.validatePasswordStrength(newPassword);
      this.validatePasswordSame(password, newPassword);
    }
    if (!skipDBVerify) {
      await localDb.verifyPassword(password);
    }
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
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }

  // passwordSet check is only done the app open
  @backgroundMethod()
  async checkPasswordSet(): Promise<boolean> {
    const checkPasswordSet = await localDb.checkPasswordSet();
    if (checkPasswordSet) {
      await this.setPasswordSetStatus(checkPasswordSet);
    }
    return checkPasswordSet;
  }

  async setPasswordSetStatus(isSet: boolean): Promise<void> {
    await passwordPersistAtom.set((v) => ({ ...v, isPasswordSet: isSet }));
  }

  // password actions --------------
  @backgroundMethod()
  async setPassword(password: string): Promise<void> {
    await this.validatePassword({ password, skipDBVerify: true });
    try {
      await this.unLockApp();
      await this.biologyAuthSavePassword(password);
      await this.setCachedPassword(password);
      await this.setPasswordSetStatus(true);
      await localDb.createPassword({ password });
    } catch (e) {
      await this.rollbackPassword();
      throw e;
    }
  }

  @backgroundMethod()
  async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.validatePassword({ password: oldPassword, newPassword });
    try {
      await this.biologyAuthSavePassword(newPassword);
      await this.setCachedPassword(newPassword);
      await this.setPasswordSetStatus(true);
      await localDb.changePassword({ oldPassword, newPassword });
    } catch (e) {
      await this.rollbackPassword(oldPassword);
      throw e;
    }
  }

  @backgroundMethod()
  async verifyPassword({
    password,
    isBiologyAuth,
  }: {
    password: string;
    isBiologyAuth?: boolean;
  }): Promise<string> {
    let finallyPassword = password;
    if (isBiologyAuth) {
      const authRes = await biologyAuth.biologyAuthenticate();
      if (authRes.success) {
        finallyPassword = await this.biologyAuthGetPassword();
      } else {
        throw new OneKeyError.BiologyAuthFailed();
      }
    }
    await this.validatePassword({ password: finallyPassword });
    await this.setCachedPassword(finallyPassword);
    return finallyPassword;
  }

  // ui ------------------------------
  @backgroundMethod()
  async promptPasswordVerify(): Promise<IPasswordRes> {
    // check ext ui open
    if (
      platformEnv.isExtension &&
      this.backgroundApi.bridgeExtBg &&
      !checkExtUIOpen(this.backgroundApi.bridgeExtBg)
    ) {
      throw new OneKeyError.OneKeyInternalError();
    }

    // TODO check field(settings protection)
    const cachedPassword = await this.getCachedPassword();
    if (cachedPassword) {
      return Promise.resolve({
        status: EPasswordResStatus.PASS_STATUS,
        password: cachedPassword,
      });
    }
    const res = new Promise((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      void this.showPasswordPromptDialog(promiseId);
    });
    return res as Promise<IPasswordRes>;
  }

  async showPasswordPromptDialog(promiseId: number) {
    await passwordAtom.set((v) => ({
      ...v,
      passwordPromptPromiseId: promiseId,
    }));
  }

  @backgroundMethod()
  async resolvePasswordPromptDialog(promiseId: number, data: IPasswordRes) {
    this.backgroundApi.servicePromise.resolveCallback({ id: promiseId, data });
    await passwordAtom.set((v) => ({
      ...v,
      passwordPromptPromiseId: undefined,
    }));
  }

  @backgroundMethod()
  async rejectPasswordPromptDialog(
    promiseId: number,
    error: { message: string },
  ) {
    this.backgroundApi.servicePromise.rejectCallback({ id: promiseId, error });
    await passwordAtom.set((v) => ({
      ...v,
      passwordPromptPromiseId: undefined,
    }));
  }

  @backgroundMethod()
  async unLockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: true }));
  }

  @backgroundMethod()
  async lockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: false }));
  }
}
