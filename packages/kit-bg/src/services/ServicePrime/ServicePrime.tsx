import { Semaphore } from 'async-mutex';
import { isString } from 'lodash';

import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  OneKeyErrorPrimeLoginExceedDeviceLimit,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyErrorPrimeMasterPasswordInvalid,
  OneKeyErrorPrimePaidMembershipRequired,
  PrimeLoginDialogCancelError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IPrimeServerUserInfo,
  IPrimeSubscriptionInfo,
  IPrimeUserInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';

import { getEndpointInfo } from '../../endpoints';
import {
  primeLoginDialogAtom,
  primePersistAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';

import type { IPrimeLoginDialogKeys } from '../../states/jotai/atoms/prime';
import type { AxiosInstance } from 'axios';

class ServicePrime extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _primeAuthClient: AxiosInstance | undefined;

  async getPrimeClient() {
    if (this._primeAuthClient) {
      return this._primeAuthClient;
    }
    const endpointInfo = await getEndpointInfo({
      name: EServiceEndpointEnum.Prime,
    });
    const client = await appApiClient.getBasicClient(endpointInfo);
    client.interceptors.request.use(async (config) => {
      const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
      if (authToken) {
        // TODO use cookie instead of simpleDb
        config.headers['X-Onekey-Request-Token'] = `${authToken}`;
      }
      return config;
    });
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        // check invalid token and logout
        const errorCode: number | undefined = (
          error as { data: { code: number } }
        )?.data?.code;
        // TODO 90_002 sdk refresh token required
        // TODO 90_003 user login required
        if ([90_002, 90_003, 90_008].includes(errorCode)) {
          appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, undefined);
          throw new OneKeyErrorPrimeLoginInvalidToken();
        }
        if ([90_004].includes(errorCode)) {
          appEventBus.emit(EAppEventBusNames.PrimeExceedDeviceLimit, undefined);
          throw new OneKeyErrorPrimeLoginExceedDeviceLimit();
        }
        if ([90_005].includes(errorCode)) {
          // appEventBus.emit(EAppEventBusNames.PrimePaidMembershipRequired, undefined);
          throw new OneKeyErrorPrimePaidMembershipRequired();
        }
        if ([90_006].includes(errorCode)) {
          const e = new OneKeyErrorPrimeMasterPasswordInvalid();
          void this.backgroundApi.servicePrimeCloudSync.showAlertDialogIfLocalPasswordInvalid(
            {
              error: e,
            },
          );
          throw e;
        }
        throw error;
      },
    );
    this._primeAuthClient = client;
    return this._primeAuthClient;
  }

  loginMutex = new Semaphore(1);

  @backgroundMethod()
  async apiLogin({ accessToken }: { accessToken: string }) {
    await this.loginMutex.runExclusive(async () => {
      if (!accessToken) {
        return;
      }
      // clear simpleDb authToken first, use custom header instead
      await this.backgroundApi.simpleDb.prime.saveAuthToken('');
      const client = await this.getPrimeClient();
      try {
        const response = await client.post<{
          data: {
            userId: string;
            inviteCode: string;
            emails: string[];
            createdAt: string;
          };
        }>(
          '/prime/v1/user/login',
          {},
          {
            headers: {
              'X-Onekey-Request-Token': `${accessToken}`,
            },
          },
        );
        // only save authToken if api login success
        await this.backgroundApi.simpleDb.prime.saveAuthToken(accessToken);
        if (response.data.data.inviteCode) {
          await this.backgroundApi.serviceReferralCode.updateMyReferralCode(
            response.data.data.inviteCode,
          );
        }
        await primePersistAtom.set((v) => ({
          ...v,
          displayEmail: response.data.data.emails[0],
          isLoggedInOnServer: true,
        }));
      } catch (error) {
        await this.backgroundApi.simpleDb.prime.saveAuthToken('');
        throw error;
      }
    });
  }

  @backgroundMethod()
  async apiLogout() {
    const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
    if (!authToken) {
      await this.setPrimePersistAtomNotLoggedIn();
      return;
    }
    const client = await this.getPrimeClient();
    await client.post('/prime/v1/user/logout');
    await this.setPrimePersistAtomNotLoggedIn();
  }

  @backgroundMethod()
  async apiLogoutPrimeUserDevice({
    instanceId,
    accessToken,
  }: {
    instanceId: string;
    accessToken: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    accessToken =
      accessToken || (await this.backgroundApi.simpleDb.prime.getAuthToken());
    const client = await this.getPrimeClient();
    // TODO 404 not found
    await client.post(
      `/prime/v1/user/device/${instanceId}`,
      {},
      {
        headers: {
          'X-Onekey-Request-Token': `${accessToken}`,
        },
      },
    );
    if (instanceId) {
      await this.apiLogin({ accessToken });
    }
  }

  @backgroundMethod()
  async apiGetPrimeUserDevices({ accessToken }: { accessToken?: string } = {}) {
    const client = await this.getPrimeClient();
    // eslint-disable-next-line no-param-reassign
    accessToken =
      accessToken || (await this.backgroundApi.simpleDb.prime.getAuthToken());
    const result = await client.get<
      IApiClientResponse<
        Array<{
          instanceId: string;
          lastLoginTime: string;
          platform: string;
          version: string;
          deviceName: string;
        }>
      >
    >('/prime/v1/user/devices', {
      headers: {
        'X-Onekey-Request-Token': `${accessToken}`,
      },
    });
    const devices = result?.data?.data;
    return devices;
  }

  @backgroundMethod()
  async callApiFetchPrimeUserInfo() {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<IPrimeServerUserInfo>>(
      '/prime/v1/user/info',
    );
    const serverUserInfo = result?.data?.data;
    return serverUserInfo;
  }

  @backgroundMethod()
  async apiFetchPrimeUserInfo(): Promise<{
    userInfo: IPrimeUserInfo;
    serverUserInfo: IPrimeServerUserInfo | undefined;
  }> {
    console.log('call servicePrime.apiFetchPrimeUserInfo');
    await this.loginMutex.waitForUnlock();
    const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
    if (!authToken) {
      await this.setPrimePersistAtomNotLoggedIn();
      const localUserInfo = await primePersistAtom.get();

      // clear privy login token cache
      appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, undefined);

      return {
        userInfo: localUserInfo,
        serverUserInfo: undefined,
      };
    }
    const serverUserInfo = await this.callApiFetchPrimeUserInfo();
    let primeSubscription: IPrimeSubscriptionInfo | undefined;
    void this.backgroundApi.servicePrimeCloudSync.showAlertDialogIfServerPasswordNotSet(
      {
        serverUserInfo,
      },
    );
    if (serverUserInfo.isPrime) {
      primeSubscription = {
        isActive: true,
        expiresAt: serverUserInfo.primeExpiredAt,
      };
    } else {
      primeSubscription = undefined;
    }
    await primePersistAtom.set((v) => ({
      ...v,
      isLoggedIn: true,
      isLoggedInOnServer: true,
      primeSubscription,
      salt: serverUserInfo.salt,
      pwdHash: serverUserInfo.pwdHash,
    }));
    const localUserInfo = await primePersistAtom.get();
    return {
      userInfo: localUserInfo,
      serverUserInfo,
    };
  }

  @backgroundMethod()
  async setPrimePersistAtomNotLoggedIn() {
    console.log('servicePrime.setPrimePersistAtomNotLoggedIn');
    await primePersistAtom.set(() => ({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      privyUserId: undefined,
      email: undefined,
      displayEmail: undefined,
      primeSubscription: undefined,
      subscriptionManageUrl: undefined,
      salt: undefined,
      pwdHash: undefined,
    }));
    await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword();
  }

  @backgroundMethod()
  async isPrimeLoggedIn() {
    const { isLoggedIn } = await primePersistAtom.get();
    return Boolean(isLoggedIn);
  }

  @backgroundMethod()
  async isPrimeSubscriptionActive() {
    if (!(await this.isPrimeLoggedIn())) {
      return false;
    }
    const { primeSubscription } = await primePersistAtom.get();
    return Boolean(primeSubscription?.isActive);
  }

  @backgroundMethod()
  async apiPreparePrimeLogin({ email }: { email: string }): Promise<{
    isRegistered: boolean;
    verifyUUID: string;
    captchaRequired: boolean;
    emailCodeRequired: boolean;
  }> {
    // await timerUtils.wait(600);
    // try {
    //   const client = await this.getClient(EServiceEndpointEnum.Prime);
    //   const result = await client.get<
    //     IApiClientResponse<{
    //       isRegistered: boolean;
    //       verifyUUID: string;
    //       captchaRequired: boolean;
    //       emailCodeRequired: boolean;
    //     }>
    //   >('/api/prime/check-email-registered', {
    //     params: {
    //       email,
    //     },
    //   });
    //   return result?.data?.data;
    // } catch (error) {
    //   console.error(error);
    // }

    // if (email.startsWith('1')) {
    //   return {
    //     isRegistered: true,
    //     verifyUUID: stringUtils.generateUUID(),
    //     captchaRequired: false,
    //     emailCodeRequired: false,
    //   };
    // }

    // return {
    //   isRegistered: false,
    //   verifyUUID: stringUtils.generateUUID(),
    //   captchaRequired: true,
    //   emailCodeRequired: true,
    // };

    throw new Error('Deprecated, use Privy instead');
  }

  @backgroundMethod()
  async apiSendEmailVerificationCode({
    email,
    verifyUUID,
  }: {
    email: string;
    verifyUUID: string;
  }): Promise<{ success: boolean }> {
    await timerUtils.wait(600);
    try {
      const client = await this.getClient(EServiceEndpointEnum.Prime);
      const result = await client.get<IApiClientResponse<{ success: boolean }>>(
        '/api/prime/send-email-verification-code',
        {
          params: {
            email,
            verifyUUID,
          },
        },
      );
      return result?.data?.data;
    } catch (error) {
      console.error(error);
    }

    return { success: true };
  }

  @backgroundMethod()
  async apiPrimeLogin({
    email,
    password,
    emailCode,
    verifyUUID,
    isRegister,
  }: {
    email: string;
    password: string;
    emailCode: string;
    verifyUUID: string;
    isRegister: boolean;
  }) {
    await timerUtils.wait(600);
    try {
      const client = await this.getClient(EServiceEndpointEnum.Prime);
      const result = await client.post<
        IApiClientResponse<{ success: boolean }>
      >('/api/prime/login', {
        data: { email, password, emailCode, verifyUUID, isRegister },
      });
      return result?.data?.data;
    } catch (error) {
      console.error(error);
    }
    return { success: false };
  }

  @backgroundMethod()
  @toastIfError()
  async ensurePrimeLoginValidEmail(email: string) {
    if (!stringUtils.isValidEmail(email)) {
      // TODO i18n error
      throw new Error('Invalid email');
    }
  }

  @backgroundMethod()
  @toastIfError()
  async startPrimeLogin() {
    const { email } = await this.promptPrimeLoginEmailDialog();

    // TODO move to UI
    const { isRegistered, verifyUUID, captchaRequired, emailCodeRequired } =
      // TODO close loading dialog and reject promise
      await this.withDialogLoading(
        {
          title: 'Checking email',
        },
        async () =>
          this.apiPreparePrimeLogin({
            email,
          }),
      );
    const isRegister = !isRegistered;

    const { masterPassword } = await this.promptPrimeLoginPasswordDialog({
      email,
      isRegister,
    });
    ensureSensitiveTextEncoded(masterPassword);

    if (captchaRequired) {
      // TODO captcha verify (register, or login retry 5 times)
    }

    let code = '';
    if (emailCodeRequired) {
      ({ code } = await this.promptPrimeLoginEmailCodeDialog({
        email,
        verifyUUID,
      }));
    }

    // TODO move to UI
    const { success } = await this.withDialogLoading(
      { title: 'Logging in' },
      async () =>
        this.apiPrimeLogin({
          email,
          password: masterPassword,
          emailCode: code,
          verifyUUID,
          isRegister,
        }),
    );

    return {
      success,
      email,
      masterPassword,
      isRegister,
      code,
      captcha: 'mock-captcha',
      verifyUUID,
    };
  }

  @backgroundMethod()
  async promptPrimeLoginEmailDialog() {
    // eslint-disable-next-line no-async-promise-executor
    const email = await new Promise<string>(async (resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      await primeLoginDialogAtom.set((v) => ({
        ...v,
        promptPrimeLoginEmailDialog: promiseId,
      }));
    });
    await this.ensurePrimeLoginValidEmail(email);
    return { email };
  }

  @backgroundMethod()
  @toastIfError()
  async resolvePrimeLoginEmailDialog({
    promiseId,
    email,
  }: {
    promiseId: number;
    email: string;
  }) {
    if (isString(email)) {
      // eslint-disable-next-line no-param-reassign
      email = email.trim();
    }
    await this.ensurePrimeLoginValidEmail(email);
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptPrimeLoginEmailDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: email,
    });
  }

  @backgroundMethod()
  async promptForgetMasterPasswordDialog() {
    const result = await new Promise(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        await primeLoginDialogAtom.set((v) => ({
          ...v,
          promptForgetMasterPasswordDialog: {
            promiseId,
          },
        }));
      },
    );
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async resolveForgetMasterPasswordDialog({
    promiseId,
  }: {
    promiseId: number;
  }) {
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptForgetMasterPasswordDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: true,
    });
  }

  @backgroundMethod()
  async promptPrimeLoginPasswordDialog({
    email,
    isRegister,
  }: {
    email?: string;
    isRegister: boolean;
  }) {
    const masterPassword = await new Promise<string>(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        await primeLoginDialogAtom.set((v) => ({
          ...v,
          promptPrimeLoginPasswordDialog: {
            email: email || '',
            isRegister,
            promiseId,
          },
        }));
      },
    );
    ensureSensitiveTextEncoded(masterPassword);
    return { masterPassword };
  }

  @backgroundMethod()
  @toastIfError()
  async resolvePrimeLoginPasswordDialog({
    promiseId,
    password,
  }: {
    promiseId: number;
    password: string;
  }) {
    ensureSensitiveTextEncoded(password);
    await timerUtils.wait(300);
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptPrimeLoginPasswordDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: password,
    });
  }

  @backgroundMethod()
  async promptPrimeLoginEmailCodeDialog({
    email,
    verifyUUID,
  }: {
    email: string;
    verifyUUID: string;
  }) {
    // eslint-disable-next-line no-async-promise-executor
    const code = await new Promise<string>(async (resolve, reject) => {
      const promiseId = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      await primeLoginDialogAtom.set((v) => ({
        ...v,
        promptPrimeLoginEmailCodeDialog: {
          email,
          verifyUUID,
          promiseId,
        },
      }));
    });
    return { code };
  }

  @backgroundMethod()
  @toastIfError()
  async resolvePrimeLoginEmailCodeDialog({
    promiseId,
    code,
  }: {
    promiseId: number;
    code: string;
  }) {
    if (!code || code.length !== 6) {
      throw new Error('Invalid code');
    }
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      promptPrimeLoginEmailCodeDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: code,
    });
  }

  @backgroundMethod()
  async cancelPrimeLogin({
    promiseId,
    dialogType,
  }: {
    promiseId: number;
    dialogType: IPrimeLoginDialogKeys;
  }) {
    const error = new PrimeLoginDialogCancelError();
    await primeLoginDialogAtom.set((v) => ({
      ...v,
      [dialogType]: undefined,
    }));
    return this.backgroundApi.servicePromise.rejectCallback({
      id: promiseId,
      error,
    });
  }

  @backgroundMethod()
  async isLoggedIn() {
    const { isLoggedIn } = await primePersistAtom.get();
    return isLoggedIn;
  }
}

export default ServicePrime;
