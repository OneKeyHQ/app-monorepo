/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, max-classes-per-file */

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RemoteApiProxyBase } from '../../RemoteApiProxyBase';

import type { IBackgroundApiWebembedCallMessage } from '../../IBackgroundApi';
import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainXmrLegacy from '../WebEmbedApiChainXmrLegacy';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type { IWebembedApi, IWebembedApiKeys } from './IWebembedApi';

class WebembedApiProxy extends RemoteApiProxyBase implements IWebembedApi {
  override checkEnvAvailable(): void {
    if (!platformEnv.isNative) {
      throw new Error(
        'WebembedApiProxy should only be used in iOS/Android Native env.',
      );
    }
  }

  override async waitRemoteApiReady(): Promise<void> {
    await wait(0);
  }

  override async callRemoteApi(options: {
    module: string;
    method: string;
    params: any[];
  }): Promise<any> {
    const { module, method, params } = options;
    const message: IBackgroundApiWebembedCallMessage = {
      module: module as any,
      method,
      params,
    };
    return backgroundApiProxy.serviceDapp.callWebEmbedApiProxy(message);
  }

  secret: WebEmbedApiSecret =
    this._createProxyModule<IWebembedApiKeys>('secret');

  chainAdaLegacy: WebEmbedApiChainAdaLegacy =
    this._createProxyModule<IWebembedApiKeys>('chainAdaLegacy');

  chainXmrLegacy: WebEmbedApiChainXmrLegacy =
    this._createProxyModule<IWebembedApiKeys>('chainXmrLegacy');
}

export default new WebembedApiProxy();
