import JsBridgeBase from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeBase';
import JsBridgeExtBackground from '@onekeyhq/inpage-provider/src/jsBridge/JsBridgeExtBackground';
import { INTERNAL_METHOD_PREFIX } from '@onekeyhq/inpage-provider/src/provider/decorators';
import {
  IInjectedProviderNames,
  IInpageProviderRequestData,
  IJsBridgeMessagePayload,
  IJsBridgeReceiveHandler,
} from '@onekeyhq/inpage-provider/src/types';
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

  bridgeReceiveHandler: IJsBridgeReceiveHandler = async (
    payload: IJsBridgeMessagePayload,
  ): Promise<any> => {
    const { scope, internal, origin } = payload;
    const request = (payload.data ?? {}) as IInpageProviderRequestData;
    const { method, params } = request;
    console.log('receiveHandler', { method, params }, scope);

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
  };

  handleSelfOriginMethods(payload: IJsBridgeMessagePayload) {
    // TODO open webview url
    console.log(payload);
  }

  handleInternalMethods(payload: IJsBridgeMessagePayload) {
    const { method, params } = (payload.data ??
      {}) as IInpageProviderRequestData;
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

  sendMessagesToInjectedBridge = (data: unknown) => {
    if (!this.bridge) {
      throw new Error('bridge should be connected first.');
    }
    if (platformEnv.isExtension) {
      // send to all dapp sites content-script
      this.bridgeExtBg?.requestToAllCS(data);
    } else {
      this.bridge.requestSync({ data });
    }
  };
}
export default BackgroundApiBase;
