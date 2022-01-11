import JsBridgeBase from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeBase';
import JsBridgeExtBackground from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeExtBackground';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/inpage-provider/src/provider/decorators';
import {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
  IJsonRpcRequest,
} from '@onekeyhq/inpage-provider/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IBackgroundApiBridge } from './BackgroundApiProxy';
import ProviderApiBase from './ProviderApiBase';
import ProviderApiEthereum from './ProviderApiEthereum';
import WalletApi from './WalletApi';

function throwMethodNotFound(method: string) {
  throw new Error(`dapp provider method not support (method=${method})`);
}

class BackgroundApiBase implements IBackgroundApiBridge {
  constructor({ walletApi }: { walletApi: WalletApi }) {
    this.walletApi = walletApi;
  }

  walletApi: WalletApi;

  bridge: JsBridgeBase | null = null;

  bridgeExtBg: JsBridgeExtBackground | null = null;

  providers: Record<string, ProviderApiBase> = {
    [IInjectedProviderNames.ethereum]: new ProviderApiEthereum({
      backgroundApi: this,
    }),
    // conflux
    // solana
    // sollet
  };

  connectBridge(bridge: JsBridgeBase) {
    if (platformEnv.isExtension) {
      this.bridgeExtBg = bridge as JsBridgeExtBackground;
    }
    this.bridge = bridge;
  }

  async _bridgeReceiveHandler(payload: IJsBridgeMessagePayload): Promise<any> {
    const { scope, internal, origin } = payload;
    const request = (payload.data ?? {}) as IJsonRpcRequest;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { method, params } = request;

    debugLogger.backgroundApi('bridgeReceiveHandler', scope, request, payload);

    const provider: ProviderApiBase | null = scope
      ? this.providers[scope]
      : null;
    if (provider) {
      return provider.handleMethods(payload);
    }

    // call background global methods (backgroundDappTest.ts)
    // Only Extension and internal call allowed
    if (
      platformEnv.isExtension &&
      internal &&
      method.startsWith(INTERNAL_METHOD_PREFIX)
    ) {
      return this.handleInternalMethods(payload);
    }

    if (origin?.endsWith('.onekey.so')) {
      return this.handleSelfOriginMethods(payload);
    }

    throwMethodNotFound(method);
  }

  bridgeReceiveHandler: IJsBridgeReceiveHandler = async (
    payload: IJsBridgeMessagePayload,
  ): Promise<any> => {
    const res = await this._bridgeReceiveHandler(payload);
    debugLogger.backgroundApi(
      'bridgeReceiveHandler->response',
      payload.scope,
      '\n',
      payload,
      '\n',
      payload.data,
      '\n -----> ',
      res,
    );
    return res;
  };

  handleSelfOriginMethods(payload: IJsBridgeMessagePayload) {
    // TODO open webview url
    console.log(payload);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async handleInternalMethods(payload: IJsBridgeMessagePayload): Promise<any> {
    const { method, params } = (payload.data ?? {}) as IJsonRpcRequest;
    const paramsArr = [].concat(params as any);

    /* eslint-disable  */
    // @ts-ignore
    const methodFunc = this[method];
    if (methodFunc) {
      // @ts-ignore
      return methodFunc.call(this, ...paramsArr);
    }
    /* eslint-enable  */

    throwMethodNotFound(method);
  }

  sendForProviderMaps: Record<string, any> = {};

  sendForProvider(providerName: IInjectedProviderNamesStrings): any {
    if (!providerName) {
      throw new Error('sendForProvider: providerName is required.');
    }
    if (!this.sendForProviderMaps[providerName]) {
      this.sendForProviderMaps[providerName] =
        this.sendMessagesToInjectedBridge.bind(this, providerName);
    }
    return this.sendForProviderMaps[providerName];
  }

  sendMessagesToInjectedBridge = (
    scope: IInjectedProviderNamesStrings,
    data: unknown,
  ) => {
    if (!this.bridge) {
      console.warn('bridge should be connected first.');
      return;
    }
    if (platformEnv.isExtension) {
      // TODO scope
      // send to all dapp sites content-script
      this.bridgeExtBg?.requestToAllCS(scope, data);
    } else {
      this.bridge.requestSync({ data, scope });
    }
  };
}
export default BackgroundApiBase;
