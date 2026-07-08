import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  OneKeyErrorPrimeLoginExceedDeviceLimit,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyErrorPrimeMasterPasswordInvalid,
  OneKeyErrorPrimePaidMembershipRequired,
} from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getEndpointInfo } from '../endpoints';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type { AxiosInstance } from 'axios';

export type IServiceBaseProps = {
  backgroundApi: any;
};

// Must use global variables, not class properties, otherwise independent properties will be generated in multiple service instances, causing the judgment to fail
let hideTimer: Array<ReturnType<typeof setTimeout> | undefined> = [];

const ONEKEY_REQUEST_TOKEN_HEADER = 'X-Onekey-Request-Token';
const ONEKEY_REQUEST_TOKEN_HEADER_LOWERCASE =
  ONEKEY_REQUEST_TOKEN_HEADER.toLowerCase();

const _oneKeyIdAuthClientsMap: Partial<
  Record<EServiceEndpointEnum, AxiosInstance | undefined>
> = {};

@backgroundClass()
export default class ServiceBase {
  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  getClientEndpointInfo = async (name: EServiceEndpointEnum) =>
    getEndpointInfo({ name });

  getClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getClient(await getEndpointInfo({ name }));

  getRawDataClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getRawDataClient(await getEndpointInfo({ name }));

  getOneKeyIdClient = async (name: EServiceEndpointEnum) => {
    if (!_oneKeyIdAuthClientsMap[name]) {
      const client = await appApiClient.getClient(
        await getEndpointInfo({ name }),
      );
      client.interceptors.request.use(async (config) => {
        const headers = config.headers as {
          get?: (headerName: string) => unknown;
          set?: (headerName: string, value: string) => void;
        } & Record<string, unknown>;
        const explicitAuthToken =
          headers?.get?.(ONEKEY_REQUEST_TOKEN_HEADER) ||
          headers?.[ONEKEY_REQUEST_TOKEN_HEADER] ||
          headers?.[ONEKEY_REQUEST_TOKEN_HEADER_LOWERCASE];
        if (explicitAuthToken) {
          return config;
        }

        // The token is opportunistic: a transient session-storage or refresh
        // failure must not reject the request interceptor (which would surface
        // as an unhandled rejection and break every service request). Resolve
        // to null and proceed without the header, letting downstream 401
        // handling recover — matching getOneKeyIdAuthHeaders below.
        // Import lazily so ServiceBase (the base of every service) does not
        // eagerly pull the Supabase/secure/web storage stack — and its
        // module-load IndexedDB init — into every service's load graph.
        const { readAuthTokenOrNull } =
          await import('./ServicePrime/primeAuthSessionAccess');
        const authToken = await readAuthTokenOrNull(() =>
          this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
        );
        if (authToken) {
          // TODO use cookie instead of simpleDb
          if (headers?.set) {
            headers.set(ONEKEY_REQUEST_TOKEN_HEADER, authToken);
          } else {
            headers[ONEKEY_REQUEST_TOKEN_HEADER] = authToken;
          }
        }
        return config;
      });
      client.interceptors.response.use(
        (response) => {
          const r = response;
          return r;
        },
        async (error) => {
          const errorData = error as {
            // set by the global axios interceptor on OneKeyServerApiError:
            // the X-Onekey-Request-Token the failed request carried
            // (the full request config is intentionally not attached)
            $$requestAuthToken?: string;
            requestId?: string;
            data: {
              code: number;
              message: string;
              messageId?: string;
              requestUrl?: string;
            };
          };
          const errorMessage: string | undefined = errorData?.data?.message;
          // check invalid token and logout
          const errorCode: number | undefined = errorData?.data?.code;
          // TODO 90_002 sdk refresh token required
          // TODO 90_003 user login required
          if ([90_002, 90_003].includes(errorCode)) {
            const requestAuthToken = errorData?.$$requestAuthToken || '';
            defaultLogger.prime.subscription.onekeyIdInvalidToken({
              url: errorData?.data?.requestUrl || '',
              errorCode,
              errorMessage: errorMessage || '',
            });
            const clearResult =
              await this.backgroundApi.servicePrime.handlePrimeLoginInvalidToken(
                {
                  requestAuthToken,
                  errorCode,
                  errorMessage,
                  requestUrl: errorData?.data?.requestUrl,
                },
              );
            if (clearResult.cleared) {
              appEventBus.emit(EAppEventBusNames.PrimeLoginInvalidToken, {
                authSessionSource: clearResult.authSessionSource,
                clearedByBackground: true,
              });
            }
            throw new OneKeyErrorPrimeLoginInvalidToken({
              message: errorMessage,
            });
          }
          if ([90_004].includes(errorCode)) {
            appEventBus.emit(
              EAppEventBusNames.PrimeExceedDeviceLimit,
              undefined,
            );
            throw new OneKeyErrorPrimeLoginExceedDeviceLimit({
              message: errorMessage,
            });
          }
          if ([90_005].includes(errorCode)) {
            throw new OneKeyErrorPrimePaidMembershipRequired({
              message: errorMessage,
            });
          }
          if ([90_006].includes(errorCode)) {
            const e = new OneKeyErrorPrimeMasterPasswordInvalid({
              message: errorMessage,
            });
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
      _oneKeyIdAuthClientsMap[name] = client;
    }
    return _oneKeyIdAuthClientsMap[name];
  };

  // Returns the OneKey ID auth header for authenticating a single request,
  // WITHOUT mutating the shared API client. Unlike getOneKeyIdClient — which
  // permanently attaches request/response interceptors (auth token + prime
  // invalid-token logout handling) onto the shared `clients[name]` instance and
  // thus affects every other consumer of that endpoint — this only attaches the
  // token to the one request it is spread into. Use it to opportunistically
  // authenticate an individual wallet-endpoint request (e.g. so the server can
  // attach per-user KYT risk data) while leaving the shared wallet client and
  // all its other callers untouched.
  getOneKeyIdAuthHeaders = async (): Promise<Record<string, string>> => {
    // The token is opportunistic (e.g. for per-user KYT data), so proceed
    // without it rather than failing the whole request.
    // Lazy import: keep the Supabase/storage stack out of ServiceBase's
    // module-load graph (see the request interceptor above).
    const { readAuthTokenOrNull } =
      await import('./ServicePrime/primeAuthSessionAccess');
    const authToken = await readAuthTokenOrNull(() =>
      this.backgroundApi.simpleDb.prime.getActiveAuthToken(),
    );
    return authToken ? { 'X-Onekey-Request-Token': authToken } : {};
  };

  @backgroundMethod()
  async getActiveWalletAccount() {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    // const result = await getActiveWalletAccount();
    // return Promise.resolve(result);
  }

  async getActiveVault() {
    // const { networkId, accountId } = await this.getActiveWalletAccount();
    // return this.backgroundApi.engine.getVault({ networkId, accountId });
  }

  _currentUrlNetworkId: string | undefined;

  _currentUrlAccountId: string | undefined;

  _currentNetworkId: string | undefined;

  _currentAccountId: string | undefined;

  @backgroundMethod()
  public async updateCurrentAccount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    if (accountUtils.isUrlAccountFn({ accountId })) {
      this._currentUrlNetworkId = networkId;
      this._currentUrlAccountId = accountId;
    } else {
      this._currentNetworkId = networkId;
      this._currentAccountId = accountId;
    }
  }

  @backgroundMethod()
  async showDialogLoading(
    payload: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
  ) {
    this.clearHideDialogLoadingTimer();
    appEventBus.emit(EAppEventBusNames.ShowDialogLoading, payload);
  }

  @backgroundMethod()
  async hideDialogLoading(
    _payload?: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
  ) {
    this.clearHideDialogLoadingTimer();
    appEventBus.emit(EAppEventBusNames.HideDialogLoading, undefined);

    // console.log('DialogLoading>>hide', payload);
  }

  clearHideDialogLoadingTimer(
    _payload?: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
  ) {
    // console.log('DialogLoading>>clear', payload, hideTimer);

    hideTimer.forEach((timer) => {
      clearTimeout(timer);
    });
    hideTimer = [];
  }

  async withDialogLoading<T>(
    payload: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    fn: () => Promise<T>,
  ) {
    try {
      this.clearHideDialogLoadingTimer(payload);
      await this.showDialogLoading(payload);
      await timerUtils.wait(100);
      const r = await fn();
      return r;
    } finally {
      this.clearHideDialogLoadingTimer();
      hideTimer.push(
        setTimeout(() => {
          void this.hideDialogLoading(payload);
        }, 600),
      );
      // console.log('DialogLoading>>done', payload, hideTimer);
    }
  }

  @backgroundMethodForDev()
  async demoDialogLoadingSample() {
    await this.withDialogLoading(
      {
        title: 'Hello',
        showExitButton: true,
      },
      async () => {
        await timerUtils.wait(3000);
      },
    );
    await timerUtils.wait(300);
    await this.withDialogLoading(
      {
        title: 'World',
        showExitButton: true,
      },
      async () => {
        await timerUtils.wait(3000);
      },
    );
    await timerUtils.wait(300);
    await this.withDialogLoading(
      {
        title: 'Javascript',
        showExitButton: true,
      },
      async () => {
        await timerUtils.wait(3000);
      },
    );
  }

  @backgroundMethod()
  async showToast(params: IAppEventBusPayload[EAppEventBusNames.ShowToast]) {
    appEventBus.emit(EAppEventBusNames.ShowToast, params);
  }

  async isDevModeEnabled() {
    const devSettings = await devSettingsPersistAtom.get();
    return !!devSettings.enabled;
  }

  @backgroundMethod()
  async showToastIfDevMode(
    params: IAppEventBusPayload[EAppEventBusNames.ShowToast],
  ) {
    if (!(await this.isDevModeEnabled())) {
      return;
    }
    appEventBus.emit(EAppEventBusNames.ShowToast, params);
  }
}
