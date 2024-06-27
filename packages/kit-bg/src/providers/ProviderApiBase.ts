/* eslint-disable @typescript-eslint/require-await,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { debounce } from 'lodash';

import {
  PROVIDER_API_METHOD_PREFIX,
  backgroundClass,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { throwMethodNotFound } from '@onekeyhq/shared/src/background/backgroundUtils';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export type IProviderBaseBackgroundNotifyInfo = {
  send: (data: any, targetOrigin: string) => void;
  targetOrigin: string;
};

@backgroundClass()
abstract class ProviderApiBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  private connectedNetworkCache: Record<string, string> = {};

  public abstract providerName: IInjectedProviderNamesStrings;

  public abstract notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void;

  public abstract notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void;

  public abstract rpcCall(request: IJsBridgeMessagePayload): any;

  async handleMethods(payload: IJsBridgeMessagePayload) {
    const { data } = payload;
    const request = data as IJsonRpcRequest;
    const { method, params = [] } = request;
    const paramsArr = [].concat(params as any);
    const methodName = `${PROVIDER_API_METHOD_PREFIX}${method}`;

    const methodFunc = (this as any)[methodName];
    const originMethodFunc = (this as any)[method];

    if (originMethodFunc && !methodFunc) {
      return throwMethodNotFound(
        'ProviderApi',
        payload.scope || '',
        methodName,
      );
    }
    if (!payload.origin) {
      throw web3Errors.provider.unauthorized('origin is required');
    }

    if (methodFunc) {
      return methodFunc.call(this, payload, ...paramsArr);
    }
    return this.rpcCall(payload);

    // TODO
    //  exists methods
    //  RPC methods
    //  throwMethodNotFound
  }

  getAccountsInfo = async (request: IJsBridgeMessagePayload) => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    return accountsInfo;
  };

  notifyNetworkChangedToDappSite = debounce(
    (targetOrigin: string) => {
      void this.backgroundApi.serviceDApp.notifyChainSwitchUIToDappSite({
        targetOrigin,
        getNetworkName: async () =>
          (await this._getConnectedNetworkName({
            origin: targetOrigin,
            scope: this.providerName,
          })) ?? '',
      });
    },
    500,
    {
      leading: true,
      trailing: false,
    },
  );

  async _getConnectedNetworkName(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );
    if (!networks?.[0]) {
      return null;
    }
    let networkName = '';
    if (request.origin) {
      const prevNetworkId = this.connectedNetworkCache[`${request.origin}`];
      if (prevNetworkId && prevNetworkId !== networks?.[0]?.id) {
        networkName = networks?.[0]?.name;
      }
      this.connectedNetworkCache[`${request.origin}`] = networks?.[0]?.id;
    }
    return networkName;
  }
}

export default ProviderApiBase;
