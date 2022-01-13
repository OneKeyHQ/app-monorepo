import EventEmitter from 'eventemitter3';
import isFunction from 'lodash/isFunction';

import JsBridgeBase from '../jsBridge/JsBridgeBase';
import { IInjectedProviderNamesStrings, IJsonRpcResponse } from '../types';

export type ConsoleLike = Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'
>;

export type IBridgeRequestCallback = (
  error: Error | null,
  result?: IJsonRpcResponse<unknown>,
) => void;

export type IInpageProviderConfig = {
  bridge: JsBridgeBase;
  logger?: ConsoleLike;
  maxEventListeners?: number;
  shouldSendMetadata?: boolean;
};

abstract class ProviderBase extends EventEmitter {
  protected constructor(config: IInpageProviderConfig) {
    super();
    this.config = config;
    this.bridge = config.bridge;
  }

  public isOneKey = true;

  protected abstract providerName: IInjectedProviderNamesStrings;

  protected readonly config: IInpageProviderConfig;

  public readonly bridge: JsBridgeBase;

  async bridgeRequest(data: unknown, callback?: IBridgeRequestCallback) {
    let hasCallback = false;
    if (callback && isFunction(callback)) {
      hasCallback = true;
    }
    try {
      const resData = await this.bridge.request({
        data: data ?? {},
        scope: this.providerName,
      });
      const result = resData ? (resData.result as unknown) : undefined;
      if (callback && hasCallback) {
        callback(null, result);
      }
      return result;
    } catch (error) {
      if (callback && hasCallback) {
        callback(error);
      }
      throw error;
    }
  }
}

export default ProviderBase;
