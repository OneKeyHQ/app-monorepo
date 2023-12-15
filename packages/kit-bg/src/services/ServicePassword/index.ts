import {
  decodePassword,
  encodeSensitiveText,
  ensureSensitiveTextEncoded,
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

import { biologyAuthUtils } from './biologyAuthUtils';
import { EPasswordResStatus } from './types';

import type { IPasswordRes } from './types';

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private cachedPassword?: string;

  @backgroundMethod()
  async encodeSensitiveText({ text }: { text: string }): Promise<string> {
    return Promise.resolve(encodeSensitiveText({ text }));
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }

  // cachePassword ------------------------------
  @backgroundMethod()
  async clearCachedPassword() {
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
  async saveBiologyAuthPassword(password: string): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (!isSupport) {
      throw new Error('biology is not support');
    }
    await biologyAuthUtils.savePassword(password);
  }

  async deleteBiologyAuthPassword(): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (!isSupport) {
      throw new Error('biology is not support');
    }
    await biologyAuthUtils.deletePassword();
  }

  async getBiologyAuthPassword(): Promise<string> {
    const isSupport = await biologyAuthUtils.isSupportBiologyAuth();
    if (!isSupport) {
      throw new Error('BiologyAuth not support');
    }
    const authRes = await biologyAuthUtils.biologyAuthenticate();
    if (!authRes.success) {
      throw new OneKeyError.BiologyAuthFailed();
    }
    const pwd = await biologyAuthUtils.getPassword();
    return pwd;
  }

  async getWebAuthPassword(): Promise<string> {
    const { webAuthCredentialId } = await passwordPersistAtom.get();
    if (webAuthCredentialId && this.cachedPassword) {
      const cred = await verifiedWebAuth(webAuthCredentialId);
      if (cred?.id === webAuthCredentialId) {
        return this.cachedPassword;
      }
    }
    throw new OneKeyError.BiologyAuthFailed();
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

  // validatePassword --------------------------------
  validatePasswordValidRules(password: string): void {
    const realPassword = decodePassword({ password });
    // **** length matched
    if (realPassword.length < 8 || realPassword.length > 128) {
      throw new OneKeyError.PasswordStrengthValidationFailed();
    }
    // **** other rules ....
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
    ensureSensitiveTextEncoded(password);
    if (newPassword) {
      ensureSensitiveTextEncoded(newPassword);
    }
    this.validatePasswordValidRules(password);
    if (newPassword) {
      this.validatePasswordValidRules(newPassword);
      this.validatePasswordSame(password, newPassword);
    }
    if (!skipDBVerify) {
      await localDb.verifyPassword(password);
    }
  }

  async rollbackPassword(password?: string): Promise<void> {
    if (!password) {
      await this.deleteBiologyAuthPassword();
      await this.clearCachedPassword();
      await this.setPasswordSetStatus(false);
    } else {
      await this.saveBiologyAuthPassword(password);
      await this.setCachedPassword(password);
    }
  }

  // passwordSet check is only done the app open
  @backgroundMethod()
  async isPasswordSet(): Promise<boolean> {
    const checkPasswordSet = await localDb.isPasswordSet();
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
  async setPassword(password: string): Promise<string> {
    await this.validatePassword({ password, skipDBVerify: true });
    try {
      await this.unLockApp();
      await this.saveBiologyAuthPassword(password);
      await this.setCachedPassword(password);
      await this.setPasswordSetStatus(true);
      await localDb.setPassword({ password });
      return password;
    } catch (e) {
      await this.rollbackPassword();
      throw e;
    }
  }

  @backgroundMethod()
  async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<string> {
    await this.validatePassword({ password: oldPassword, newPassword });
    try {
      await this.saveBiologyAuthPassword(newPassword);
      await this.setCachedPassword(newPassword);
      await this.setPasswordSetStatus(true);
      await localDb.updatePassword({ oldPassword, newPassword });
      return newPassword;
    } catch (e) {
      await this.rollbackPassword(oldPassword);
      throw e;
    }
  }

  @backgroundMethod()
  async verifyPassword({
    password,
    isBiologyAuth,
    isWebAuth,
  }: {
    password: string;
    isBiologyAuth?: boolean;
    isWebAuth?: boolean;
  }): Promise<string> {
    let verifyingPassword = password;
    if (isBiologyAuth) {
      verifyingPassword = await this.getBiologyAuthPassword();
    }
    if (isWebAuth) {
      verifyingPassword = await this.getWebAuthPassword();
    }
    await this.validatePassword({ password: verifyingPassword });
    await this.setCachedPassword(verifyingPassword);
    return verifyingPassword;
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

  // lock ---------------------------
  @backgroundMethod()
  async unLockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: true }));
  }

  @backgroundMethod()
  async lockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: false }));
  }
}
