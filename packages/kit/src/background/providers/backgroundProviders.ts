import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { IBackgroundApi, IBackgroundApiBridge } from '../IBackgroundApi';

import ProviderApiBase from './ProviderApiBase';
import ProviderApiEthereum from './ProviderApiEthereum';
import ProviderApiPrivate from './ProviderApiPrivate';
import ProviderApiSolana from './ProviderApiSolana';

function createBackgroundProviders({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApiBridge | IBackgroundApi;
}) {
  const backgroundProviders: Record<string, ProviderApiBase> = {
    [IInjectedProviderNames.$private]: new ProviderApiPrivate({
      backgroundApi,
    }),
    [IInjectedProviderNames.ethereum]: new ProviderApiEthereum({
      backgroundApi,
    }),
    [IInjectedProviderNames.solana]: new ProviderApiSolana({
      backgroundApi,
    }),
    // near
    // conflux
    // sollet
  };

  return backgroundProviders;
}

export { createBackgroundProviders };
