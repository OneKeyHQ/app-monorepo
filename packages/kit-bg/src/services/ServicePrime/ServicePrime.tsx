import { Semaphore } from 'async-mutex';
import { chunk, cloneDeep, isString } from 'lodash';

import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import {
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID } from '@onekeyhq/shared/src/consts/primeConsts';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  OneKeyLocalError,
  OneKeyServerApiError,
  PrimeLoginDialogCancelError,
} from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { ETranslateEngine } from '@onekeyhq/shared/types/discovery';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IPrimeDeviceInfo,
  IPrimeServerUserInfo,
  IPrimeSubscriptionInfo,
  IPrimeUserInfo,
  IShopifyOrder,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  primeLoginDialogAtom,
  primePersistAtom,
  primePersistAtomInitialValue,
  primeServerMasterPasswordStatusAtom,
} from '../../states/jotai/atoms/prime';
import ServiceBase from '../ServiceBase';

import type {
  IPrimeLoginDialogAtomData,
  IPrimeLoginDialogKeys,
  IPrimePersistAtomData,
} from '../../states/jotai/atoms/prime';

class ServicePrime extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async getPrimeClient() {
    return this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
  }

  @backgroundMethod()
  async apiTranslate({
    texts,
    sourceLang,
    targetLang,
    engine = ETranslateEngine.standard,
    testFlag,
  }: {
    texts: string[];
    sourceLang: string;
    targetLang: string;
    engine?: ETranslateEngine;
    testFlag?: string;
  }): Promise<{ translations: Array<string | null> }> {
    const client = await this.getPrimeClient();
    // API limit: max 4 texts per translate request
    const batches = chunk(texts, 4);
    const requestConfig: Parameters<typeof client.post>[2] & {
      autoHandleError?: boolean;
    } = {
      autoHandleError: false,
    };
    const results: Array<Array<string | null>> = await Promise.all(
      batches.map(async (batch): Promise<Array<string | null>> => {
        try {
          const res = await client.post<{
            code: number;
            message: string;
            data?: {
              translations?: Array<string | null>;
            };
          }>(
            '/prime/v1/translate/dapp',
            {
              texts: batch,
              source_lang: sourceLang,
              target_lang: targetLang,
              engine,
              test_flag: testFlag,
              category: 'dapp_browser',
            },
            requestConfig,
          );

          if (res.data.code !== 0) {
            throw new OneKeyServerApiError({
              autoToast: false,
              disableFallbackMessage: true,
              message: res.data.message || 'OneKeyServer Unknown Error',
              code: res.data.code,
              httpStatusCode: res.status,
              data: res.data,
            });
          }

          const translations = res?.data?.data?.translations;

          return Array.isArray(translations) ? translations : batch;
        } catch (error) {
          const errorCode = Number((error as OneKeyError | undefined)?.code);
          if ([90_104, 90_105].includes(errorCode)) {
            throw error;
          }

          console.error('[Prime Translate] batch error:', error);
          return batch;
        }
      }),
    );
    return { translations: results.flat() };
  }

  @backgroundMethod()
  async apiDeleteAccount({
    uuid,
    emailOTP,
  }: {
    uuid: string;
    emailOTP: string;
  }) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
    const result = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/user/delete',
      {
        uuid,
        emailOTP,
      },
    );
    return result?.data?.data;
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
          data: IPrimeServerUserInfo;
        }>(
          '/prime/v1/user/login',
          {},
          {
            headers: {
              'X-Onekey-Request-Token': accessToken,
            },
          },
        );
        // only save authToken if api login success
        await this.backgroundApi.simpleDb.prime.saveAuthToken(accessToken);

        await this.updatePrimeAtomByServerUserInfo({
          serverUserInfo: response.data.data,
        });
      } catch (error) {
        await this.backgroundApi.simpleDb.prime.saveAuthToken('');
        throw error;
      }
    });
  }

  @backgroundMethod()
  async apiLogout() {
    const currentAtomValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `ServicePrime.apiLogout: starting logout for user ${currentAtomValue.onekeyUserId}`,
    });

    const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
    if (!authToken) {
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason: 'ServicePrime.apiLogout: simpleDb.prime.getAuthToken() is null',
      });
      await this.setPrimePersistAtomNotLoggedIn();
      return;
    }
    const client = await this.getPrimeClient();
    try {
      await client.post('/prime/v1/user/logout');
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: 'ServicePrime.apiLogout: server logout success',
      });
    } catch (e) {
      console.error(e);
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `ServicePrime.apiLogout: server logout failed: ${String(e)}`,
      });
      const error = e as OneKeyError | undefined;
      if (error && error?.key === 'id.login_expired_description') {
        error.autoToast = false;
      }
      throw e;
    } finally {
      // Server logout is best-effort; local state must always clear so
      // the UI cannot keep rendering the previously-logged-in account.
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: 'ServicePrime.apiLogout: clearing local token and atom',
      });
      await this.backgroundApi.simpleDb.prime.saveAuthToken('');
      await this.setPrimePersistAtomNotLoggedIn();
      const clearedAtomValue = await primePersistAtom.get();
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: `ServicePrime.apiLogout: atom cleared, isLoggedIn=${clearedAtomValue.isLoggedIn}, onekeyUserId=${clearedAtomValue.onekeyUserId}`,
      });
    }
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
          'X-Onekey-Request-Token': accessToken,
        },
      },
    );
    if (instanceId) {
      await this.apiLogin({ accessToken });
      // Refresh from /user/info for accurate isPrimeDeviceLimitExceeded,
      // as the login endpoint may return stale device limit data after removal
      try {
        const serverUserInfo = await this.callApiFetchPrimeUserInfo();
        if (serverUserInfo) {
          await this.updatePrimeAtomByServerUserInfo({ serverUserInfo });
        }
      } catch (e) {
        // Log but don't fail — apiLogin already updated the atom with best-effort data
        console.error(e);
      }
    }
  }

  @backgroundMethod()
  async apiGetPrimeUserDevices({ accessToken }: { accessToken?: string } = {}) {
    const client = await this.getPrimeClient();
    // eslint-disable-next-line no-param-reassign
    accessToken =
      accessToken || (await this.backgroundApi.simpleDb.prime.getAuthToken());
    const result = await client.get<IApiClientResponse<IPrimeDeviceInfo[]>>(
      '/prime/v1/user/devices',
      {
        headers: {
          'X-Onekey-Request-Token': accessToken,
        },
      },
    );
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
  async apiFetchServerRandomIdInfo() {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<{ uuid: string }>>(
      '/prime/v1/general/get-random-id',
    );
    const randomId = result?.data?.data;
    return randomId;
  }

  @backgroundMethod()
  async apiFetchPhoneOtp({ email, otp }: { email: string; otp: string }) {
    const client = await this.getPrimeClient();

    const result = await client.post<
      IApiClientResponse<{ phone: string; otp: string }>
    >('/prime/v1/general/phone-otp', {
      email,
      otp,
    });

    return result?.data?.data;
  }

  async updatePrimeAtomByServerUserInfo({
    serverUserInfo,
  }: {
    serverUserInfo: IPrimeServerUserInfo;
  }) {
    const beforeValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `updatePrimeAtomByServerUserInfo: before update, atom isPrime=${beforeValue.primeSubscription?.isActive}, atom userId=${beforeValue.onekeyUserId}, server isPrime=${serverUserInfo?.isPrime}, server userId=${serverUserInfo?.userId}`,
    });

    let primeSubscription: IPrimeSubscriptionInfo | undefined;
    if (serverUserInfo.isPrime) {
      primeSubscription = {
        isActive: true,
        expiresAt: serverUserInfo.primeExpiredAt,
        willRenew: serverUserInfo.willRenew,
        subscriptions: serverUserInfo.subscriptions,
      };
    } else {
      primeSubscription = undefined;
    }

    const serverManagementUrl =
      serverUserInfo.subscriptions?.[0]?.managementUrl;

    // Sync the server KYT state into the settings cache before exposing
    // onekeyUserId, so the settings switch and intro dialog gate (both keyed by
    // onekeyUserId) read the latest interface value once the user becomes active.
    await this.backgroundApi.serviceSetting.syncKytEnabledFromServer({
      onekeyUserId: serverUserInfo?.userId,
      kytEnabled: serverUserInfo?.kytEnabled,
    });

    await primePersistAtom.set((v): IPrimePersistAtomData => {
      const userEmail = serverUserInfo?.emails?.[0] || undefined;
      return {
        ...v,
        avatar: serverUserInfo?.avatar,
        nickname: serverUserInfo?.nickname,
        email: userEmail, // TODO update from PrimeGlobalEffect
        displayEmail: userEmail,
        onekeyUserId: serverUserInfo?.userId,
        isEnablePrime: serverUserInfo?.isEnablePrime,
        isEnableSandboxPay: serverUserInfo?.isEnableSandboxPay,
        isPrimeDeviceLimitExceeded: serverUserInfo?.isPrimeDeviceLimitExceeded,
        isLoggedIn: true,
        isLoggedInOnServer: true,
        primeSubscription,
        // Fallback: use server managementUrl when local SDK hasn't set it yet
        subscriptionManageUrl: v.subscriptionManageUrl || serverManagementUrl,
        // salt: serverUserInfo.salt,
        // pwdHash: serverUserInfo.pwdHash,
      };
    });

    const afterValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `updatePrimeAtomByServerUserInfo: after update, atom isPrime=${afterValue.primeSubscription?.isActive}, atom userId=${afterValue.onekeyUserId}`,
    });

    if (serverUserInfo?.inviteCode) {
      await this.backgroundApi.serviceReferralCode.updateMyReferralCode(
        serverUserInfo.inviteCode,
      );
    }

    return {
      primeSubscription,
    };
  }

  @backgroundMethod()
  async apiFetchPrimeUserInfo(): Promise<{
    userInfo: IPrimeUserInfo;
    serverUserInfo: IPrimeServerUserInfo | undefined;
    primeSubscription: IPrimeSubscriptionInfo | undefined;
  }> {
    console.log('call servicePrime.apiFetchPrimeUserInfo');
    await this.loginMutex.waitForUnlock();
    const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
    if (!authToken) {
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: simpleDb.prime.getAuthToken() is null',
      });
      await this.setPrimePersistAtomNotLoggedIn();
      const localUserInfo = await primePersistAtom.get();

      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: '',
        errorCode: -1759,
        errorMessage:
          'servicePrime.apiFetchPrimeUserInfo: simpleDb.prime.getAuthToken() No auth token',
      });
      // clear supabase login token cache
      appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, undefined);

      return {
        userInfo: localUserInfo,
        serverUserInfo: undefined,
        primeSubscription: undefined,
      };
    }
    const serverUserInfo = await this.callApiFetchPrimeUserInfo();

    // Re-check auth token after the network request returns. If the user
    // logged out while this request was in flight, the simpleDb token will
    // have been cleared. Discarding the response prevents an in-flight
    // request from writing the previous account's data back into the atom
    // after logout.
    const authTokenAfterFetch =
      await this.backgroundApi.simpleDb.prime.getAuthToken();
    if (!authTokenAfterFetch) {
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason:
          'ServicePrime.apiFetchPrimeUserInfo: auth token cleared during request, discarding response',
      });
      await this.setPrimePersistAtomNotLoggedIn();
      const localUserInfo = await primePersistAtom.get();
      return {
        userInfo: localUserInfo,
        serverUserInfo: undefined,
        primeSubscription: undefined,
      };
    }

    void this.backgroundApi.servicePrimeCloudSync.showAlertDialogIfServerPasswordNotSet(
      {
        serverUserInfo,
      },
    );
    void this.backgroundApi.servicePrimeCloudSync.showAlertDialogIfServerPasswordChanged(
      {
        serverUserInfo,
      },
    );

    const { primeSubscription } = await this.updatePrimeAtomByServerUserInfo({
      serverUserInfo,
    });

    const localUserInfo = await primePersistAtom.get();

    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const isServerMasterPasswordSet = Boolean(
      serverPasswordUUID &&
      serverPasswordUUID !== RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID,
    );
    await primeServerMasterPasswordStatusAtom.set((v) => ({
      ...v,
      isServerMasterPasswordSet,
    }));

    return {
      userInfo: localUserInfo,
      serverUserInfo,
      primeSubscription,
    };
  }

  @backgroundMethod()
  async setPrimePersistAtomNotLoggedIn() {
    const beforeValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `setPrimePersistAtomNotLoggedIn: before clear, isLoggedIn=${beforeValue.isLoggedIn}, onekeyUserId=${beforeValue.onekeyUserId}, isPrime=${beforeValue.primeSubscription?.isActive}`,
    });

    await primePersistAtom.set(
      (): IPrimePersistAtomData => cloneDeep(primePersistAtomInitialValue),
    );

    const afterValue = await primePersistAtom.get();
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: `setPrimePersistAtomNotLoggedIn: after clear, isLoggedIn=${afterValue.isLoggedIn}, onekeyUserId=${afterValue.onekeyUserId}, isPrime=${afterValue.primeSubscription?.isActive}`,
    });

    await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword();
    await primeServerMasterPasswordStatusAtom.set((v) => ({
      ...v,
      isServerMasterPasswordSet: false,
    }));
  }

  @backgroundMethod()
  async isLoggedIn() {
    const { isLoggedIn, isLoggedInOnServer } = await primePersistAtom.get();
    const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
    const result = Boolean(isLoggedIn && isLoggedInOnServer && authToken);

    if (!result) {
      // debugger;
      defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
        reason: `isLoggedIn=false ${JSON.stringify({
          isLoggedIn,
          isLoggedInOnServer,
          authTokenExists: !!authToken,
        })}`,
      });
    }
    return result;
  }

  @backgroundMethod()
  async isPrimeSubscriptionActive() {
    if (!(await this.isLoggedIn())) {
      return false;
    }
    const { primeSubscription } = await primePersistAtom.get();
    return Boolean(primeSubscription?.isActive);
  }

  @backgroundMethod()
  async apiPreparePrimeLogin(_props: { email: string }): Promise<{
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

    throw new OneKeyLocalError('Deprecated, use supabase instead');
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
      throw new OneKeyLocalError('Invalid email');
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
          // title: 'Checking email',
          title: appLocale.intl.formatMessage({
            id: ETranslations.global_processing,
          }),
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
      {
        // title: 'Logging in',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
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
    isVerifyMasterPassword,
    isChangeMasterPassword,
    serverUserInfo,
  }: {
    email?: string;
    isRegister: boolean;
    isVerifyMasterPassword?: boolean;
    isChangeMasterPassword?: boolean;
    serverUserInfo?: IPrimeServerUserInfo;
  }) {
    const masterPassword = await new Promise<string>(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        await primeLoginDialogAtom.set(
          (v): IPrimeLoginDialogAtomData => ({
            ...v,
            promptPrimeLoginPasswordDialog: {
              email: email || '',
              isRegister,
              isVerifyMasterPassword,
              isChangeMasterPassword,
              serverUserInfo,
              promiseId,
            },
          }),
        );
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
      throw new OneKeyLocalError('Invalid code');
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
  async sendEmailOTP(scene: EPrimeEmailOTPScene) {
    if (!scene) {
      throw new OneKeyLocalError('sendEmailOTP ERROR: Invalid scene');
    }
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Prime);
    const result = await client.post<
      IApiClientResponse<{
        resendAt: number;
        uuid: string;
      }>
    >('/prime/v1/general/emailOTP', {
      scene,
    });
    return result?.data?.data;
  }

  @backgroundMethod()
  async apiGetCustomerJWT() {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<{ token: string }>>(
      '/prime/v1/general/customer_jwt',
    );
    return result?.data?.data;
  }

  @backgroundMethod()
  async getLocalUserInfo() {
    return primePersistAtom.get();
  }

  @backgroundMethod()
  async apiFetchShopifyOrders(): Promise<IShopifyOrder[]> {
    const client = await this.getPrimeClient();
    const result = await client.get<IApiClientResponse<IShopifyOrder[]>>(
      '/prime/v1/user/shopify-orders',
    );
    return result?.data?.data ?? [];
  }

  @backgroundMethod()
  async updatePrimeUserProfile({
    avatar,
    nickname,
  }: {
    avatar: string;
    nickname: string;
  }) {
    const client = await this.getPrimeClient();
    const result = await client.put<IApiClientResponse<{ success: boolean }>>(
      `/prime/v1/user/info`,
      {
        avatar,
        nickname,
      },
    );
    setTimeout(() => {
      void this.apiFetchPrimeUserInfo();
    });
    return result.data.code === 0;
  }
}

export default ServicePrime;
