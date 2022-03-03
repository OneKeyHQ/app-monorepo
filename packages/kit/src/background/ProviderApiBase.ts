/* eslint-disable @typescript-eslint/require-await,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

import { RootRoutes } from '../routes/types';

import { IBackgroundApi, IDappCallParams } from './IBackgroundApi';

export type IProviderBaseBackgroundNotifyInfo = {
  accounts?: string[];
  chainId?: string;
  networkVersion?: string;
  send: (data: any) => void;
};

abstract class ProviderApiBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  get walletApi() {
    if (this.backgroundApi.walletApi) {
      return this.backgroundApi.walletApi;
    }
    throw new Error('walletApi init error');
  }

  get bridge() {
    return this.backgroundApi.bridge;
  }

  public abstract providerName: IInjectedProviderNamesStrings;

  public abstract notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void;

  public abstract notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void;

  protected abstract rpcCall(request: IJsonRpcRequest): any;

  async handleMethods(payload: IJsBridgeMessagePayload) {
    const { data } = payload;
    const request = data as IJsonRpcRequest;
    const { method, params = [] } = request;
    const paramsArr = [].concat(params as any);

    const methodFunc = (this as any)[method];
    if (methodFunc) {
      return methodFunc.call(this, payload, ...paramsArr);
    }
    return this.rpcCall(request);

    // TODO
    //  exists methods
    //  RPC methods
    //  throwMethodNotFound
  }

  async openDappApprovalModal({
    request,
    screens = [],
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
  }) {
    return new Promise((resolve, reject) => {
      if (!this.backgroundApi.promiseContainer) {
        throw new Error('promiseContainer not found in backgroundApi');
      }
      const id = this.backgroundApi.promiseContainer.createCallback({
        resolve,
        reject,
      });
      const modalParams: { screen: any; params: any } = {
        screen: null,
        params: {},
      };
      let paramsCurrent = modalParams;
      let paramsLast = modalParams;
      screens.forEach((screen) => {
        paramsCurrent.screen = screen;
        paramsCurrent.params = {};
        paramsLast = paramsCurrent;
        paramsCurrent = paramsCurrent.params;
      });
      paramsLast.params = {
        id,
        origin: request.origin,
        scope: request.scope, // ethereum
        data: JSON.stringify(request.data),
      } as IDappCallParams;

      global.$navigationRef.current?.navigate(RootRoutes.Modal, modalParams);

      // TODO extension open new window
      // extUtils.openApprovalWindow();
    });
  }
}

export default ProviderApiBase;
