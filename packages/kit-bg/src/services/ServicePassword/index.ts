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
import * as OneKeyError from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';

import localDb from '../../dbs/local/localDb';
import { settingsPersistAtom } from '../../states/jotai/atoms';
import {
  passwordAtom,
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
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }

  @backgroundMethod()
  async encodeSensitiveText({ text }: { text: string }): Promise<string> {
    return Promise.resolve(encodeSensitiveText({ text }));
  }

  // ---------------------------------------------- password verify

  validatePasswordValidRules(password: string): void {
    const realPassword = decodePassword({ password });
    // **** length matched
    if (realPassword.length < 8 || realPassword.length > 128) {
      throw new OneKeyError.PasswordStrengthValidationFailed();
    }
    // **** other rules ....
  }

  @backgroundMethod()
  async verifyPassword(
    password: string,
    { skipDBVerify = false }: { skipDBVerify?: boolean } = {},
  ): Promise<void> {
    this.validatePasswordValidRules(password);
    if (!skipDBVerify) {
      await localDb.verifyPassword(password);
      await this.setCachedPassword(password);
    }
  }

  // ---------------------------------------------- Biology Auth

  @backgroundMethod()
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
    await this.verifyPassword(pwd);
    return pwd;
  }

  async saveBiologyAuthPassword(password: string): Promise<void> {
    ensureSensitiveTextEncoded(password);
    const isSupport = await biologyAuthUtils.isSupportBiologyAuth();
    if (isSupport) {
      await biologyAuthUtils.savePassword(password);
    }
  }

  async deleteBiologyAuthPassword(): Promise<void> {
    const isSupport = await biologyAuthUtils.isSupportBiologyAuth();
    if (isSupport) {
      await biologyAuthUtils.deletePassword();
    }
  }

  @backgroundMethod()
  async setBiologyAuthEnable(enable: boolean): Promise<void> {
    if (enable) {
      const authRes = await biologyAuthUtils.biologyAuthenticate();
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
  async getWebAuthPassword(): Promise<string> {
    const { webAuthCredentialId } = await passwordPersistAtom.get();
    if (webAuthCredentialId && this.cachedPassword) {
      const cred = await verifiedWebAuth(webAuthCredentialId);
      if (cred?.id === webAuthCredentialId) {
        await this.verifyPassword(this.cachedPassword);
        return this.cachedPassword;
      }
    }
    throw new OneKeyError.BiologyAuthFailed();
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

  // ---------------------------------------------- cache password

  @backgroundMethod()
  async clearCachedPassword() {
    this.cachedPassword = undefined;
  }

  async setCachedPassword(password: string): Promise<string> {
    ensureSensitiveTextEncoded(password);
    this.cachedPassword = password;
    return password;
  }

  @backgroundMethod()
  async getCachedPassword(): Promise<string | undefined> {
    if (!this.cachedPassword) {
      return undefined;
    }
    return this.cachedPassword;
  }

  // ---------------------------------------------- password manage

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

  // check is only done the app open
  @backgroundMethod()
  async isPasswordSet(): Promise<boolean> {
    const checkPasswordSet = await localDb.isPasswordSet();
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
    ensureSensitiveTextEncoded(oldPassword);
    ensureSensitiveTextEncoded(newPassword);
    if (oldPassword === newPassword) {
      throw new OneKeyError.PasswordUpdateSameFailed();
    }
    await this.verifyPassword(oldPassword);
    await this.verifyPassword(newPassword, { skipDBVerify: true });
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
  async setPassword(password: string): Promise<string> {
    ensureSensitiveTextEncoded(password);
    if (await this.isPasswordSet()) {
      throw new Error('password is set, use updatePassword instead');
    }
    await this.verifyPassword(password, { skipDBVerify: true });
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

  // ---------------------------------------------- UI

  @backgroundMethod()
  async promptPasswordVerify(): Promise<IPasswordRes> {
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

    const r = new Promise((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      void this.showPasswordPromptDialog(promiseId);
    });
    return r as Promise<IPasswordRes>;
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

  // ---------------------------------------------- lock

  @backgroundMethod()
  async unLockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: true }));
  }

  @backgroundMethod()
  async lockApp() {
    await passwordAtom.set((v) => ({ ...v, unLock: false }));
  }
}
