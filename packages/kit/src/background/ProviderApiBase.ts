/* eslint-disable @typescript-eslint/require-await,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */
import {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

import { IBackgroundApi } from './IBackgroundApi';

export type IProviderBaseBackgroundNotifyInfo = {
  send: (data: any) => void;
};

abstract class ProviderApiBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

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
}

export default ProviderApiBase;
