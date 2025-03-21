import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { getEndpointInfo } from '../endpoints';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

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

  getClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getClient(await getEndpointInfo({ name }));

  getRawDataClient = async (name: EServiceEndpointEnum) =>
    appApiClient.getRawDataClient(await getEndpointInfo({ name }));

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
