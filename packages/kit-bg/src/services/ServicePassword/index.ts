import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type {
  IDecryptStringParams,
  IEncryptStringParams,
} from '@onekeyhq/core/src/secret';
import {
  decodePassword,
  decodeSensitiveText,
  decrypt,
  decryptString,
  encodeSensitiveText,
  encryptString,
  ensureSensitiveTextEncoded,
  getBgSensitiveTextEncodeKey,
  revealEntropyToMnemonic,
} from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import * as OneKeyErrors from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import {
  EPasswordVerifyStatus,
  type IPasswordSecuritySession,
} from '@onekeyhq/shared/types/password';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import localDb from '../../dbs/local/localDb';
import {
  firmwareUpdateWorkflowRunningAtom,
  settingsLastActivityAtom,
  settingsPersistAtom,
  v4migrationAtom,
} from '../../states/jotai/atoms';
import {
  passwordAtom,
  passwordBiologyAuthInfoAtom,
  passwordPersistAtom,
  passwordPromptPromiseTriggerAtom,
} from '../../states/jotai/atoms/password';
import ServiceBase from '../ServiceBase';
import { checkExtUIOpen } from '../utils';

import { biologyAuthUtils } from './biologyAuthUtils';
import { EPasswordPromptType } from './types';

import type { IPasswordRes } from './types';

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private cachedPassword?: string;

  private cachedPasswordActivityTimeStep = 0;

  private cachedPasswordTTL: number = timerUtils.getTimeDurationMs({
    hour: 2,
  });

  private passwordPromptTTL: number = timerUtils.getTimeDurationMs({
    minute: 5,
  });

  private passwordPromptTimeout: NodeJS.Timeout | null = null;

  private securitySession?: IPasswordSecuritySession;

  private extCheckLockStatusTimer?: ReturnType<typeof setInterval>;

  @backgroundMethod()
  async encodeSensitiveText({ text }: { text: string }): Promise<string> {
    return Promise.resolve(encodeSensitiveText({ text }));
  }

  @backgroundMethod()
  async decryptMnemonicFromDbCredential(
    password: string,
    contents: Array<{ id: string; credential: string }>,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      const pwd = await this.encodeSensitiveText({ text: password });
      const items = contents
        .map((t) => {
          const o: { entropy: string } = JSON.parse(t.credential);
          if (!o.entropy) {
            return '';
          }
          const entropyBuff = decrypt(pwd, o.entropy);
          const mnemonic = revealEntropyToMnemonic(entropyBuff);
          return mnemonic;
        })
        .filter(Boolean);

      return {
        items,
        raw: items.join('\r\n\r\n'),
      };
    }
    return null;
  }

  @backgroundMethod()
  async encryptString(params: IEncryptStringParams) {
    return encryptString(params);
  }

  @backgroundMethod()
  async decryptString(params: IDecryptStringParams) {
    return decryptString(params);
  }

  @backgroundMethod()
  async encryptByInstanceId(input: string): Promise<string> {
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    const output = encodeSensitiveText({
      text: input,
      key: instanceId,
    });
    return Promise.resolve(output);
  }

  @backgroundMethod()
  async decryptByInstanceId(input: string): Promise<string> {
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    const output = decodeSensitiveText({
      encodedText: input,
      key: instanceId,
    });
    return Promise.resolve(output);
  }

  @backgroundMethod()
  async decodeSensitiveText({
    encodedText,
  }: {
    encodedText: string;
  }): Promise<string> {
    return Promise.resolve(decodeSensitiveText({ encodedText }));
  }

  @backgroundMethod()
  async getBgSensitiveTextEncodeKey(): Promise<string> {
    return Promise.resolve(getBgSensitiveTextEncodeKey());
  }

  clearPasswordPromptTimeout() {
    if (this.passwordPromptTimeout) {
      clearTimeout(this.passwordPromptTimeout);
    }
  }

  // cachePassword ------------------------------
  @backgroundMethod()
  async clearCachedPassword() {
    this.cachedPassword = undefined;
  }

  async setCachedPassword(password: string): Promise<string> {
    ensureSensitiveTextEncoded(password);
    this.cachedPassword = password;
    this.cachedPasswordActivityTimeStep = Date.now();
    return password;
  }

  @backgroundMethod()
  async getCachedPassword(): Promise<string | undefined> {
    const now = Date.now();
    if (
      !this.cachedPassword ||
      now - this.cachedPasswordActivityTimeStep > this.cachedPasswordTTL ||
      now < this.cachedPasswordActivityTimeStep
    ) {
      await this.clearCachedPassword();
      return undefined;
    }
    this.cachedPasswordActivityTimeStep = now;
    return this.cachedPassword;
  }

  @backgroundMethod()
  async getCachedPasswordOrDeviceParams({ walletId }: { walletId: string }) {
    const isHardware = accountUtils.isHwWallet({ walletId });
    let password: string | undefined = '';
    let deviceParams: IDeviceSharedCallParams | undefined;

    if (isHardware) {
      deviceParams =
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId,
        });
    }
    if (
      accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isImportedWallet({ walletId })
    ) {
      password = await this.getCachedPassword();
    }
    return {
      password,
      isHardware,
      deviceParams,
    };
  }

  // biologyAuth&WebAuth ------------------------------
  async saveBiologyAuthPassword(password: string): Promise<void> {
    ensureSensitiveTextEncoded(password);
    /* The password also needs to be stored when the system closes the fingerprint identification, 
       so that the user can open the system fingerprint identification later
    */
    // const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    // if (isSupport) {
    await biologyAuthUtils.savePassword(password);
    // }
  }

  async deleteBiologyAuthPassword(): Promise<void> {
    const { isSupport } = await passwordBiologyAuthInfoAtom.get();
    if (isSupport) {
      await biologyAuthUtils.deletePassword();
    }
  }

  async getBiologyAuthPassword(): Promise<string> {
    const isSupport = await passwordBiologyAuthInfoAtom.get();
    if (!isSupport) {
      await this.setBiologyAuthEnable(false);
      throw new Error('biologyAuth not support');
    }
    const authRes = await biologyAuthUtils.biologyAuthenticate();
    if (!authRes.success) {
      throw new OneKeyErrors.BiologyAuthFailed();
    }
    try {
      const pwd = await biologyAuthUtils.getPassword();
      ensureSensitiveTextEncoded(pwd);
      return pwd;
    } catch (e) {
      await this.setBiologyAuthEnable(false);
      throw new OneKeyErrors.BiologyAuthFailed();
    }
  }

  @backgroundMethod()
  async setBiologyAuthEnable(
    enable: boolean,
    skipAuth?: boolean,
  ): Promise<void> {
    if (enable && !skipAuth) {
      const authRes = await biologyAuth.biologyAuthenticate();
      if (!authRes.success) {
        throw new OneKeyErrors.BiologyAuthFailed();
      }
      const catchPassword = await this.getCachedPassword();
      if (catchPassword) {
        await this.saveBiologyAuthPassword(catchPassword);
      } else {
        throw new Error(
          'no catch password please unlock the application again or modify the password.',
        );
      }
    }
    await backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(enable);
  }

  // validatePassword --------------------------------
  validatePasswordValidRules(password: string): void {
    ensureSensitiveTextEncoded(password);
    const realPassword = decodePassword({ password });
    // **** length matched
    if (realPassword.length < 8 || realPassword.length > 128) {
      throw new OneKeyErrors.PasswordStrengthValidationFailed();
    }
    // **** other rules ....
  }

  validatePasswordSame(password: string, newPassword: string) {
    ensureSensitiveTextEncoded(password);
    ensureSensitiveTextEncoded(newPassword);

    const realPassword = decodePassword({ password });
    const realNewPassword = decodePassword({ password: newPassword });
    if (realPassword === realNewPassword) {
      throw new OneKeyErrors.PasswordUpdateSameFailed();
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
      ensureSensitiveTextEncoded(password);
      await this.saveBiologyAuthPassword(password);
      await this.setCachedPassword(password);
    }
  }

  @backgroundMethod()
  async checkPasswordSet(): Promise<boolean> {
    const checkPasswordSet = await localDb.isPasswordSet();
    await this.setPasswordSetStatus(checkPasswordSet);
    return checkPasswordSet;
  }

  async setPasswordSetStatus(isSet: boolean): Promise<void> {
    await passwordPersistAtom.set((v) => ({ ...v, isPasswordSet: isSet }));
  }

  // password actions --------------
  @backgroundMethod()
  async setPassword(password: string): Promise<string> {
    ensureSensitiveTextEncoded(password);
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
    ensureSensitiveTextEncoded(oldPassword);
    ensureSensitiveTextEncoded(newPassword);

    await this.validatePassword({ password: oldPassword, newPassword });
    try {
      await this.backgroundApi.serviceAddressBook.updateHash(newPassword);
      await this.saveBiologyAuthPassword(newPassword);
      await this.setCachedPassword(newPassword);
      await this.setPasswordSetStatus(true);
      // update v5 db password
      await localDb.updatePassword({ oldPassword, newPassword });
      // update v4 db password
      await this.backgroundApi.serviceV4Migration.updateV4Password({
        oldPassword,
        newPassword,
      });
      await this.backgroundApi.serviceAddressBook.finishUpdateHash();
      return newPassword;
    } catch (e) {
      await this.backgroundApi.serviceAddressBook.rollback(oldPassword);
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
    let verifyingPassword = password;
    if (isBiologyAuth) {
      verifyingPassword = await this.getBiologyAuthPassword();
    }
    ensureSensitiveTextEncoded(verifyingPassword);
    await this.validatePassword({ password: verifyingPassword });
    await this.setCachedPassword(verifyingPassword);
    return verifyingPassword;
  }

  // ui ------------------------------
  @backgroundMethod()
  async promptPasswordVerify(options?: {
    reason?: EReasonForNeedPassword;
    dialogProps?: IDialogShowProps;
  }): Promise<IPasswordRes> {
    const v4migrationData = await v4migrationAtom.get();
    if (v4migrationData?.isProcessing) {
      const v4migrationPassword =
        await this.backgroundApi.serviceV4Migration.getMigrationPasswordV5();
      if (v4migrationPassword) {
        return {
          password: v4migrationPassword,
        };
      }
    }

    const { reason } = options || {};
    // check ext ui open
    if (
      platformEnv.isExtension &&
      this.backgroundApi.bridgeExtBg &&
      !checkExtUIOpen(this.backgroundApi.bridgeExtBg)
    ) {
      throw new OneKeyErrors.OneKeyInternalError();
    }

    const needReenterPassword = await this.isAlwaysReenterPassword(reason);
    if (!needReenterPassword) {
      const cachedPassword = await this.getCachedPassword();
      if (cachedPassword) {
        ensureSensitiveTextEncoded(cachedPassword);
        return Promise.resolve({
          password: cachedPassword,
        });
      }
    }

    const isPasswordSet = await this.checkPasswordSet();
    this.clearPasswordPromptTimeout();
    const res = new Promise((resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      void this.showPasswordPromptDialog({
        idNumber: promiseId,
        type: isPasswordSet
          ? EPasswordPromptType.PASSWORD_VERIFY
          : EPasswordPromptType.PASSWORD_SETUP,
        dialogProps: options?.dialogProps,
      });
    });
    const result = await (res as Promise<IPasswordRes>);
    ensureSensitiveTextEncoded(result.password);

    // wait PromptPasswordDialog close animation
    await timerUtils.wait(600);
    return result;
  }

  @backgroundMethod()
  async promptPasswordVerifyByWallet({
    walletId,
    reason = EReasonForNeedPassword.CreateOrRemoveWallet,
  }: {
    walletId: string;
    reason?: EReasonForNeedPassword;
  }) {
    const isHardware = accountUtils.isHwWallet({ walletId });
    let password = '';
    let deviceParams: IDeviceSharedCallParams | undefined;

    if (isHardware) {
      try {
        deviceParams =
          await this.backgroundApi.serviceAccount.getWalletDeviceParams({
            walletId,
          });
      } catch (error) {
        //
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isPasswordSet = await localDb.isPasswordSet();
    if (
      accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isImportedWallet({ walletId })
      // || isPasswordSet // Do not prompt password for external,watching account action
    ) {
      ({ password } = await this.promptPasswordVerify({ reason }));
    }
    return {
      password,
      isHardware,
      deviceParams,
    };
  }

  @backgroundMethod()
  async promptPasswordVerifyByAccount({
    accountId,
    reason,
  }: {
    accountId: string;
    reason?: EReasonForNeedPassword;
  }) {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    return this.promptPasswordVerifyByWallet({ walletId, reason });
  }

  async showPasswordPromptDialog(params: {
    idNumber: number;
    type: EPasswordPromptType;
    dialogProps?: IDialogShowProps;
  }) {
    await passwordPromptPromiseTriggerAtom.set((v) => ({
      ...v,
      passwordPromptPromiseTriggerData: params,
    }));
    this.passwordPromptTimeout = setTimeout(() => {
      void this.cancelPasswordPromptDialog(params.idNumber);
    }, this.passwordPromptTTL);
  }

  @backgroundMethod()
  async resolvePasswordPromptDialog(promiseId: number, data: IPasswordRes) {
    this.clearPasswordPromptTimeout();
    if (data.password) {
      ensureSensitiveTextEncoded(data.password);
    }
    void this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data,
    });
    await passwordPromptPromiseTriggerAtom.set((v) => ({
      ...v,
      passwordPromptPromiseTriggerData: undefined,
    }));
  }

  @backgroundMethod()
  async cancelPasswordPromptDialog(promiseId: number) {
    const error = new OneKeyErrors.PasswordPromptDialogCancel();
    return this.rejectPasswordPromptDialog({ promiseId, error });
  }

  @backgroundMethod()
  async rejectPasswordPromptDialog({
    promiseId,
    message,
    error,
  }: {
    promiseId: number;
    message?: string;
    error?: IOneKeyError;
  }) {
    const errorReject =
      error ??
      new OneKeyErrors.OneKeyError({
        message: message || 'rejectPasswordPromptDialog',
      });
    this.clearPasswordPromptTimeout();
    void this.backgroundApi.servicePromise.rejectCallback({
      id: promiseId,
      error: errorReject,
    });
    await passwordPromptPromiseTriggerAtom.set((v) => ({
      ...v,
      passwordPromptPromiseTriggerData: undefined,
    }));
  }

  // lock ---------------------------
  @backgroundMethod()
  async unLockApp() {
    await passwordAtom.set((v) => ({
      ...v,
      unLock: true,
      manualLocking: false,
    }));
  }

  @backgroundMethod()
  async resetPasswordStatus() {
    await passwordAtom.set((v) => ({
      ...v,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
      manualLocking: false,
    }));
  }

  @backgroundMethod()
  async lockApp(options?: { manual: boolean }) {
    const { manual = true } = options || {};
    const isFirmwareUpdateRunning =
      await firmwareUpdateWorkflowRunningAtom.get();
    if (isFirmwareUpdateRunning) {
      return;
    }
    if (await this.backgroundApi.serviceV4Migration.isAtMigrationPage()) {
      return;
    }
    await this.clearCachedPassword();
    if (manual) {
      await passwordAtom.set((v) => ({ ...v, manualLocking: true }));
    }
    await passwordAtom.set((v) => ({ ...v, unLock: false }));
  }

  @backgroundMethod()
  public async setAppLockDuration(value: number) {
    await passwordAtom.set((v) => ({ ...v, unLock: true }));
    await passwordPersistAtom.set((prev) => ({
      ...prev,
      appLockDuration: value,
    }));
  }

  @backgroundMethod()
  public async setEnableSystemIdleLock(value: boolean) {
    await passwordPersistAtom.set((prev) => ({
      ...prev,
      enableSystemIdleLock: value,
    }));
  }

  @backgroundMethod()
  async checkLockStatus() {
    const { isPasswordSet, appLockDuration } = await passwordPersistAtom.get();
    if (!isPasswordSet) {
      return;
    }
    const { time: lastActivity } = await settingsLastActivityAtom.get();
    const idleDuration = Math.floor((Date.now() - lastActivity) / (1000 * 60));
    if (idleDuration >= appLockDuration) {
      await this.lockApp({ manual: false });
    }
  }

  @backgroundMethod()
  async addExtIntervalCheckLockStatusListener() {
    if (platformEnv.isExtensionBackground && !this.extCheckLockStatusTimer) {
      this.extCheckLockStatusTimer = setInterval(() => {
        // skip check lock status when ext ui open
        if (
          this.backgroundApi.bridgeExtBg &&
          !checkExtUIOpen(this.backgroundApi.bridgeExtBg)
        ) {
          void this.checkLockStatus();
        }
      }, 1000 * 30);
    }
  }

  @backgroundMethod()
  public async isAlwaysReenterPassword(
    reason?: EReasonForNeedPassword,
  ): Promise<boolean> {
    const isPasswordSet = await this.checkPasswordSet();
    if (!reason || !isPasswordSet) {
      return false;
    }
    const { protectCreateOrRemoveWallet, protectCreateTransaction } =
      await settingsPersistAtom.get();

    // always reenter password for Security, eg change password/backup wallet
    if (reason === EReasonForNeedPassword.Security) {
      return true;
    }

    const result =
      (reason === EReasonForNeedPassword.CreateOrRemoveWallet &&
        protectCreateOrRemoveWallet) ||
      (reason === EReasonForNeedPassword.CreateTransaction &&
        protectCreateTransaction);

    const now = Date.now();
    if (
      !result ||
      !this.securitySession ||
      now - this.securitySession.startAt > this.securitySession.timeout ||
      now < this.securitySession.startAt
      // return result immediately if result is false or last visit is timeout/ not exist
    ) {
      return result;
    }
    const lastVisit = this.securitySession.lastVisit[reason];
    if (lastVisit) {
      return now - lastVisit > this.securitySession.timeout;
    }
    this.securitySession.lastVisit[reason] = now;
    return result;
  }

  @backgroundMethod()
  async openPasswordSecuritySession(params?: { timeout?: number }) {
    this.securitySession = {
      startAt: Date.now(),
      timeout: params?.timeout ?? 1000 * 60, // default 1 minute
      lastVisit: {},
    };
  }

  @backgroundMethod()
  async closePasswordSecuritySession() {
    this.securitySession = undefined;
  }
}
