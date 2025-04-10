import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundClass,
  backgroundMethod,
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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getEndpointInfo } from '../endpoints';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type { AxiosInstance } from 'axios';

export type IServiceBaseProps = {
  backgroundApi: any;
};

@backgroundClass()
export default class ServiceBase {
  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  _currentNetworkId: string | undefined;

  _currentAccountId: string | undefined;

  _oneKeyIdAuthClient: AxiosInstance | undefined;

  getClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getClient(await getEndpointInfo({ name }));

  getRawDataClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getRawDataClient(await getEndpointInfo({ name }));

  getOneKeyIdClient = async (name: EServiceEndpointEnum) => {
    if (!this._oneKeyIdAuthClient) {
      const client = await appApiClient.getClient(
        await getEndpointInfo({ name }),
      );
      client.interceptors.request.use(async (config) => {
        const authToken =
          await this.backgroundApi.simpleDb.prime.getAuthToken();
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
            appEventBus.emit(
              EAppEventBusNames.PrimeLoginInvalidToken,
              undefined,
            );
            throw new OneKeyErrorPrimeLoginInvalidToken();
          }
          if ([90_004].includes(errorCode)) {
            appEventBus.emit(
              EAppEventBusNames.PrimeExceedDeviceLimit,
              undefined,
            );
            throw new OneKeyErrorPrimeLoginExceedDeviceLimit();
          }
          if ([90_005].includes(errorCode)) {
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
      this._oneKeyIdAuthClient = client;
    }
    return this._oneKeyIdAuthClient;
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

  @backgroundMethod()
  public async updateCurrentAccount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    this._currentNetworkId = networkId;
    this._currentAccountId = accountId;
  }

  @backgroundMethod()
  async showDialogLoading(
    payload: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
  ) {
    appEventBus.emit(EAppEventBusNames.ShowDialogLoading, payload);
  }

  @backgroundMethod()
  async hideDialogLoading() {
    appEventBus.emit(EAppEventBusNames.HideDialogLoading, undefined);
  }

  hideTimer: ReturnType<typeof setTimeout> | undefined;

  async withDialogLoading<T>(
    payload: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    fn: () => Promise<T>,
  ) {
    try {
      clearTimeout(this.hideTimer);
      await this.showDialogLoading(payload);
      const r = await fn();
      return r;
    } finally {
      await timerUtils.wait(600);
      await this.hideDialogLoading();
      // this.hideTimer = setTimeout(() => {
      //   this.hideDialogLoading();
      // }, 600);
    }
  }

  @backgroundMethod()
  async showToast(params: IAppEventBusPayload[EAppEventBusNames.ShowToast]) {
    appEventBus.emit(EAppEventBusNames.ShowToast, params);
  }

  @backgroundMethod()
  async showToast2(params: IAppEventBusPayload[EAppEventBusNames.ShowToast]) {
    appEventBus.emit(EAppEventBusNames.ShowToast, params);
  }
}
