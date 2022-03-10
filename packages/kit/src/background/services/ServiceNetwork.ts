import {
  GeneralInitialState,
  changeActiveNetwork,
} from '../../store/reducers/general';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  @backgroundMethod()
  changeActiveNetwork(
    network: NonNullable<GeneralInitialState['activeNetwork']>,
  ) {
    this.backgroundApi.dispatch(changeActiveNetwork(network));
    this.notifyChainChanged();
  }

  @backgroundMethod()
  notifyChainChanged(): void {
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappChainChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
  }
}

export default ServiceNetwork;
