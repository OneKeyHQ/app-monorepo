import { Semaphore } from 'async-mutex';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type {
  IDecryptStringParams,
  IEncryptStringParams,
} from '@onekeyhq/core/src/secret';
import {
  decodePasswordAsync,
  decodeSensitiveTextAsync,
  decryptAsync,
  decryptStringAsync,
  encodeSensitiveTextAsync,
  encryptStringAsync,
  ensureSensitiveTextEncoded,
  getBgSensitiveTextEncodeKey,
  revealEntropyToMnemonic,
} from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import * as OneKeyErrors from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import * as deviceErrorUtils from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EHardwareCallContext,
  type IDeviceSharedCallParams,
} from '@onekeyhq/shared/types/device';
import type {
  IPasswordRes,
  IPasswordSecuritySession,
} from '@onekeyhq/shared/types/password';
import {
  BIOLOGY_AUTH_CANCEL_ERROR,
  EPasswordMode,
  EPasswordPromptType,
  EPasswordVerifyStatus,
  PASSCODE_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
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
import webembedApiProxy from '../../webembeds/instance/webembedApiProxy';
import ServiceBase from '../ServiceBase';
import { checkExtUIOpen } from '../utils';

import { biologyAuthNativeError, biologyAuthUtils } from './biologyAuthUtils';

@backgroundClass()
export default class ServicePassword extends ServiceBase {
  private cachedPassword?: string;

  private cachedPasswordTTL: number = timerUtils.getTimeDurationMs({
    hour: 2,
  });

  private cachedPasswordTimeOutObject: ReturnType<typeof setTimeout> | null =
    null;

  private passwordPromptTTL: number = timerUtils.getTimeDurationMs({
    minute: 5,
  });

  private passwordPromptTimeout: ReturnType<typeof setTimeout> | null = null;

  private securitySession?: IPasswordSecuritySession;

  private extCheckLockStatusTimer?: ReturnType<typeof setInterval>;

  private handleBiologyAuthError(authRes: {
    warning?: string;
    error: string;
    success: boolean;
  }) {
    if (!authRes.success) {
      if (authRes.warning || authRes.error === BIOLOGY_AUTH_CANCEL_ERROR) {
        const nativeError = new Error(
          authRes.error === BIOLOGY_AUTH_CANCEL_ERROR ? '' : authRes.warning,
        );
        nativeError.name = authRes.error;
        nativeError.cause = biologyAuthNativeError;
        throw nativeError;
      } else {
        throw new OneKeyErrors.BiologyAuthFailed();
      }
    }
  }

  @backgroundMethod()
  async encodeSensitiveText({ text }: { text: string }): Promise<string> {
    return Promise.resolve(encodeSensitiveTextAsync({ text }));
  }

  @backgroundMethod()
  async decryptMnemonicFromDbCredential(
    password: string,
    contents: Array<{ id: string; credential: string }>,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      const pwd = await this.encodeSensitiveText({ text: password });
      const itemsPromised = contents
        .map(async (t) => {
          const o: { entropy: string } = JSON.parse(t.credential);
          if (!o.entropy) {
            return '';
          }
          const entropyBuff = await decryptAsync({
            password: pwd,
            data: o.entropy,
          });
          const mnemonic = revealEntropyToMnemonic(entropyBuff);
          return mnemonic;
        })
        .filter(Boolean);
      const items = await Promise.all(itemsPromised);
      return {
        items,
        raw: items.join('\r\n\r\n'),
      };
    }
    return null;
  }

  @backgroundMethod()
  async encryptString(params: IEncryptStringParams) {
    return encryptStringAsync(params);
  }

  @backgroundMethod()
  async decryptString(params: IDecryptStringParams) {
    return decryptStringAsync(params);
  }

  @backgroundMethod()
  async encryptByInstanceId(input: string): Promise<string> {
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    const output = await encodeSensitiveTextAsync({
      text: input,
      key: instanceId,
    });
    return Promise.resolve(output);
  }

  @backgroundMethod()
  async decryptByInstanceId(input: string): Promise<string> {
    const instanceId = await this.backgroundApi.serviceSetting.getInstanceId();
    const output = await decodeSensitiveTextAsync({
      encodedText: input,
      key: instanceId,
      allowRawPassword: true,
    });
    return Promise.resolve(output);
  }

  @backgroundMethod()
  async decodeSensitiveText({
    encodedText,
  }: {
    encodedText: string;
  }): Promise<string> {
    return Promise.resolve(await decodeSensitiveTextAsync({ encodedText }));
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
    this.backgroundApi.serviceAddressBook.verifyHashTimestamp = undefined;

    // TODO clear cached sync credential only when app is locked
    void this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
  }

  async setCachedPassword({ password }: { password: string }): Promise<string> {
    const prevPassword = this.cachedPassword;
    ensureSensitiveTextEncoded(password);
    this.cachedPassword = password;
    if (this.cachedPasswordTimeOutObject) {
      clearTimeout(this.cachedPasswordTimeOutObject);
    }
    this.cachedPasswordTimeOutObject = setTimeout(() => {
      void this.clearCachedPassword();
    }, this.cachedPasswordTTL);

    void (async () => {
      const prevPasswordRaw = prevPassword
        ? await this.decodeSensitiveText({
            encodedText: prevPassword,
          })
        : '';
      const newPasswordRaw = password
        ? await this.decodeSensitiveText({
            encodedText: password,
          })
        : '';
      if (password && prevPasswordRaw !== newPasswordRaw) {
        await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently(
          {
            callerName: 'setCachedPassword',
          },
        );
      }
    })();
    return password;
  }

  @backgroundMethod()
  async getCachedPassword(): Promise<string | undefined> {
    if (this.cachedPasswordTimeOutObject) {
      clearTimeout(this.cachedPasswordTimeOutObject);
    }
    this.cachedPasswordTimeOutObject = setTimeout(() => {
      void this.clearCachedPassword();
    }, this.cachedPasswordTTL);
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
          hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
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
      throw new OneKeyErrors.OneKeyLocalError('biologyAuth not support');
    }
    const authRes = await biologyAuthUtils.biologyAuthenticate();
    if (!authRes.success) {
      this.handleBiologyAuthError(authRes);
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
        this.handleBiologyAuthError(authRes);
      }
      const catchPassword = await this.getCachedPassword();
      if (catchPassword) {
        await this.saveBiologyAuthPassword(catchPassword);
      } else {
        throw new OneKeyErrors.OneKeyLocalError(
          'no catch password please unlock the application again or modify the password.',
        );
      }
    }
    await this.backgroundApi.serviceSetting.setBiologyAuthSwitchOn(enable);
    if (platformEnv.isExtension && !enable) {
      await this.clearWebAuthCredentialId();
    }
  }

  // validatePassword --------------------------------
  async validatePasswordValidRules({
    password,
    passwordMode,
  }: {
    passwordMode: EPasswordMode;
    password: string;
  }): Promise<void> {
    ensureSensitiveTextEncoded(password);
    const realPassword = await decodePasswordAsync({
      password,
    });
    // **** length matched
    if (
      passwordMode === EPasswordMode.PASSWORD &&
      (realPassword.length < PASSWORD_MIN_LENGTH ||
        realPassword.length > PASSWORD_MAX_LENGTH)
    ) {
      throw new OneKeyErrors.PasswordStrengthValidationFailed();
    }
    if (passwordMode === EPasswordMode.PASSCODE) {
      if (realPassword.length !== PASSCODE_LENGTH) {
        throw new OneKeyErrors.PasswordStrengthValidationFailed();
      }
    }
    // **** other rules ....
  }

  async validatePasswordSame({
    newPassword,
    password,
  }: {
    newPassword: string;
    password: string;
  }): Promise<void> {
    ensureSensitiveTextEncoded(password);
    ensureSensitiveTextEncoded(newPassword);
    const realPassword = await decodePasswordAsync({
      password,
    });
    const realNewPassword = await decodePasswordAsync({
      password: newPassword,
    });
    if (realPassword === realNewPassword) {
      throw new OneKeyErrors.PasswordUpdateSameFailed();
    }
  }

  async validatePassword({
    password,
    passwordMode,
    newPassword,
    skipDBVerify,
  }: {
    password: string;
    passwordMode: EPasswordMode;
    newPassword?: string;
    skipDBVerify?: boolean;
  }): Promise<void> {
    ensureSensitiveTextEncoded(password);
    if (newPassword) {
      ensureSensitiveTextEncoded(newPassword);
    }
    if (!newPassword) {
      await this.validatePasswordValidRules({
        password,
        passwordMode,
      });
    } else {
      await this.validatePasswordValidRules({
        password: newPassword,
        passwordMode,
      });
      await this.validatePasswordSame({
        newPassword,
        password,
      });
    }
    if (!skipDBVerify) {
      await localDb.verifyPassword({ password });
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
      await this.setCachedPassword({ password });
    }
  }

  @backgroundMethod()
  async checkPasswordSet(): Promise<boolean> {
    const checkPasswordSet = await localDb.isPasswordSet();
    await this.setPasswordSetStatus(checkPasswordSet);
    return checkPasswordSet;
  }

  async clearWebAuthCredentialId(): Promise<void> {
    await passwordPersistAtom.set((v) => ({
      ...v,
      webAuthCredentialId: '',
    }));
  }

  async setPasswordSetStatus(
    isSet: boolean,
    passMode?: EPasswordMode,
  ): Promise<void> {
    await passwordPersistAtom.set((v) => ({
      ...v,
      isPasswordSet: isSet,
      ...(passMode ? { passwordMode: passMode } : {}),
    }));
  }

  // password actions --------------
  @backgroundMethod()
  async setPassword(
    password: string,
    passwordMode: EPasswordMode,
  ): Promise<string> {
    ensureSensitiveTextEncoded(password);
    await this.validatePassword({ password, passwordMode, skipDBVerify: true });
    try {
      await this.unLockApp();
      await this.saveBiologyAuthPassword(password);
      await this.setCachedPassword({ password });
      await this.setPasswordSetStatus(true, passwordMode);
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
    passwordMode: EPasswordMode,
  ): Promise<string> {
    ensureSensitiveTextEncoded(oldPassword);
    ensureSensitiveTextEncoded(newPassword);

    if (!oldPassword) {
      throw new OneKeyErrors.OneKeyLocalError('oldPassword is required');
    }

    if (!newPassword) {
      throw new OneKeyErrors.OneKeyLocalError('newPassword is required');
    }

    await this.validatePassword({
      password: oldPassword,
      newPassword,
      passwordMode,
    });
    let masterPasswordUpdateRollback: (() => Promise<void>) | undefined;
    try {
      await this.backgroundApi.serviceAddressBook.updateHash(newPassword);
      await this.saveBiologyAuthPassword(newPassword);
      await this.setCachedPassword({ password: newPassword });
      await this.setPasswordSetStatus(true, passwordMode);
      ({ rollback: masterPasswordUpdateRollback } =
        await this.backgroundApi.serviceMasterPassword.updatePasscodeForMasterPassword(
          {
            oldPasscode: oldPassword,
            newPasscode: newPassword,
          },
        ));
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
      try {
        await this.backgroundApi.serviceAddressBook.rollback(oldPassword);
      } catch (rollbackError) {
        console.error(rollbackError);
      }

      try {
        await this.rollbackPassword(oldPassword);
      } catch (rollbackError) {
        console.error(rollbackError);
      }

      try {
        await masterPasswordUpdateRollback?.();
      } catch (rollbackError) {
        console.error(rollbackError);
      }

      throw e;
    }
  }

  @backgroundMethod()
  async verifyPassword({
    password,
    passwordMode,
    isBiologyAuth,
  }: {
    password: string;
    passwordMode: EPasswordMode;
    isBiologyAuth?: boolean;
  }): Promise<string> {
    let verifyingPassword = password;
    if (isBiologyAuth) {
      verifyingPassword = await this.getBiologyAuthPassword();
    }
    ensureSensitiveTextEncoded(verifyingPassword);
    await this.validatePassword({
      password: verifyingPassword,
      passwordMode,
    });
    await this.setCachedPassword({
      password: verifyingPassword,
    });
    if (verifyingPassword) {
      void (async () => {
        try {
          await this.backgroundApi.serviceAccount.generateAllHdAndQrWalletsHashAndXfp(
            {
              password: verifyingPassword,
            },
          );
        } catch (e) {
          console.error(e);
        }
        try {
          let skipAppStatusCheck = false;
          if (
            !this._mergeDuplicateHDWalletsExecuted &&
            globalThis?.$indexedDBIsMigratedToBucket?.isMigrated === false
          ) {
            console.log('verifyPassword__mergeDuplicateHDWallets', {
              skipAppStatusCheck,
            });
            skipAppStatusCheck = true;
          }
          await this.backgroundApi.serviceAccount.mergeDuplicateHDWallets({
            password: verifyingPassword,
            skipAppStatusCheck,
          });
        } catch (e) {
          console.error(e);
        } finally {
          this._mergeDuplicateHDWalletsExecuted = true;
        }
      })();
    }
    return verifyingPassword;
  }

  _mergeDuplicateHDWalletsExecuted = false;

  // ui ------------------------------
  promptPasswordVerifyMutex = new Semaphore(1);

  @backgroundMethod()
  async promptPasswordVerify(options?: {
    reason?: EReasonForNeedPassword;
    dialogProps?: IDialogShowProps;
  }): Promise<IPasswordRes> {
    // console.log('promptPasswordVerify call');
    return this.promptPasswordVerifyMutex.runExclusive(async () => {
      // TODO mutex
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
    });
  }

  @backgroundMethod()
  async promptPasswordVerifyByWallet({
    walletId,
    reason = EReasonForNeedPassword.CreateOrRemoveWallet,
    hardwareCallContext = EHardwareCallContext.USER_INTERACTION,
  }: {
    walletId: string;
    reason?: EReasonForNeedPassword;
    hardwareCallContext?: EHardwareCallContext;
  }) {
    const isHardware = accountUtils.isHwWallet({ walletId });
    const isQrWallet = accountUtils.isQrWallet({ walletId });
    let password = '';
    let deviceParams: IDeviceSharedCallParams | undefined;

    if (isHardware) {
      try {
        deviceParams =
          await this.backgroundApi.serviceAccount.getWalletDeviceParams({
            walletId,
            hardwareCallContext,
          });
      } catch (error) {
        // Check if this is a hardware error that should be thrown
        if (
          deviceErrorUtils.isHardwareError({ error: error as IOneKeyError })
        ) {
          throw error;
        }
        // ignore other errors
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isPasswordSet = await localDb.isPasswordSet();
    if (
      accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isImportedWallet({ walletId })
      // || isPasswordSet // Do not prompt password for external,watching account action
    ) {
      defaultLogger.account.accountCreatePerf.ignoreDurationBegin();
      ({ password } = await this.promptPasswordVerify({ reason }));
      defaultLogger.account.accountCreatePerf.ignoreDurationEnd();
    }
    return {
      password,
      isHardware,
      isQrWallet,
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

  @backgroundMethod()
  async waitPasswordEncryptorReady() {
    if (platformEnv.isNative) {
      await webembedApiProxy.waitRemoteApiReady();
    }
    return true;
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
    // Delay execution to avoid UI jank
    setTimeout(() => {
      void this.backgroundApi.serviceApp.dispatchUnlockJob();
    });
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
    this.backgroundApi.serviceAddressBook.verifyHashTimestamp = undefined;
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
    const unavailableTime = Date.now() < lastActivity;
    if (idleDuration >= appLockDuration || unavailableTime) {
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
