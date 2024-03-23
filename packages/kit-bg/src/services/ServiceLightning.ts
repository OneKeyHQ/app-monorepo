import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EEndpointName } from '@onekeyhq/shared/types/endpoint';

import ClientLightning from '../vaults/impls/lightning/sdkLightning/ClientLightning';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceLightning extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getLnClient(isTestnet: boolean) {
    return this.getClientCache(isTestnet);
  }

  private getClientCache = memoizee(
    async (isTestnet: boolean) => {
      const _client = await this.backgroundApi.serviceLightning.getClient(
        EEndpointName.LN,
      );
      return new ClientLightning(_client, isTestnet);
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  @backgroundMethod()
  public async sampleMethod() {
    console.log('sampleMethod');
    return 'sampleMethod';
  }
}

export default ServiceLightning;
