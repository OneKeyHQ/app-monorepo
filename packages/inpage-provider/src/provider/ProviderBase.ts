import EventEmitter from 'eventemitter3';
import JsBridgeBase from '../jsBridge/JsBridgeBase';

export type IInpageProviderConfig = { bridge: JsBridgeBase };

class ProviderBase extends EventEmitter {
  constructor(config: IInpageProviderConfig) {
    super();
    this.config = config;
    this.bridge = config.bridge;
  }

  protected readonly config: IInpageProviderConfig;

  protected readonly bridge: JsBridgeBase;
}

export default ProviderBase;
