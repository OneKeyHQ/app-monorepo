import {
  IInjectedProviderNames,
  IInjectedProviderNamesStrings,
} from '../types';

import ProviderBase from './ProviderBase';

class ProviderPrivate extends ProviderBase {
  protected providerName: IInjectedProviderNamesStrings =
    IInjectedProviderNames.$private;

  request(data: unknown) {
    return this.bridgeRequest(data);
  }
}

export default ProviderPrivate;
