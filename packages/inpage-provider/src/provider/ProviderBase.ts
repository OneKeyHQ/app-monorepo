import EventEmitter from 'eventemitter3';

import JsBridgeBase from '../jsBridge/JsBridgeBase';
import { IInjectedProviderNamesStrings } from '../types';

export type IInpageProviderConfig = { bridge: JsBridgeBase };

abstract class ProviderBase extends EventEmitter {
  protected constructor(config: IInpageProviderConfig) {
    super();
    this.config = config;
    this.bridge = config.bridge;
  }

  protected abstract providerName: IInjectedProviderNamesStrings;

  protected readonly config: IInpageProviderConfig;

  protected readonly bridge: JsBridgeBase;
}

export default ProviderBase;
