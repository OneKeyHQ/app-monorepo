import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceGas extends ServiceBase {
  @backgroundMethod()
  async getGasInfo({ networkId }: { networkId: string }) {
    const { engine } = this.backgroundApi;
    return engine.getGasInfo(networkId);
  }

  @backgroundMethod()
  async getTxWaitingSeconds({ networkId }: { networkId: string }) {
    const { engine } = this.backgroundApi;
    const vault = await engine.getChainOnlyVault(networkId);
    return vault.getTxWaitingSeconds();
  }
}

export default ServiceGas;
