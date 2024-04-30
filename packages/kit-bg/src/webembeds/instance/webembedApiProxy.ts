/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, max-classes-per-file */

import { wait } from '@onekeyfe/hd-core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { RemoteApiProxyBase } from '../../apis/RemoteApiProxyBase';

import type { IWebembedApi, IWebembedApiKeys } from './IWebembedApi';
import type { IBackgroundApiWebembedCallMessage } from '../../apis/IBackgroundApi';
import type WebEmbedApiChainAdaLegacy from '../WebEmbedApiChainAdaLegacy';
import type WebEmbedApiChainXmrLegacy from '../WebEmbedApiChainXmrLegacy';
import type WebEmbedApiSecret from '../WebEmbedApiSecret';
import type WebEmbedApiTest from '../WebEmbedApiTest';

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

  protected override async callRemoteApi(options: {
    module: IWebembedApiKeys;
    method: string;
    params: any[];
  }): Promise<any> {
    const { module, method, params } = options;
    const message: IBackgroundApiWebembedCallMessage = {
      module: module as any,
      method,
      params,
    };
    return backgroundApiProxy.serviceDApp.callWebEmbedApiProxy(message);
  }

  isSDKReady(): Promise<boolean> {
    return Promise.resolve(
      !!backgroundApiProxy.serviceDApp.isWebEmbedApiReady(),
    );
  }

  test: WebEmbedApiTest = this._createProxyModule<IWebembedApiKeys>('test');

  secret: WebEmbedApiSecret =
    this._createProxyModule<IWebembedApiKeys>('secret');

  chainAdaLegacy: WebEmbedApiChainAdaLegacy =
    this._createProxyModule<IWebembedApiKeys>('chainAdaLegacy');

  chainXmrLegacy: WebEmbedApiChainXmrLegacy =
    this._createProxyModule<IWebembedApiKeys>('chainXmrLegacy');
}

export default new WebembedApiProxy();
