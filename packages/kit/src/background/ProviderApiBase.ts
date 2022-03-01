/* eslint-disable @typescript-eslint/require-await,@typescript-eslint/no-unused-vars,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
import { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

import WalletApi from './WalletApi';

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

  backgroundApi: any;

  get walletApi() {
    return this.backgroundApi.walletApi as WalletApi;
  }

  get bridge() {
    return this.backgroundApi.bridge as JsBridgeBase;
  }

  public abstract providerName: IInjectedProviderNamesStrings;

  public abstract notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void;

  public abstract notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void;

  protected abstract rpcCall(request: IJsonRpcRequest): any;

  protected rpcResult(result: any) {
    return {
      id: undefined,
      jsonrpc: '2.0',
      result,
    };
  }

  async handleMethods(payload: IJsBridgeMessagePayload) {
    const { origin, data } = payload;
    const request = data as IJsonRpcRequest;
    const { method, params = [] } = request;
    const paramsArr = [].concat(params as any);

    // @ts-ignore
    const methodFunc = this[method];
    if (methodFunc) {
      // @ts-ignore
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
