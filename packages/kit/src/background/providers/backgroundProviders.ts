import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { IBackgroundApi, IBackgroundApiBridge } from '../IBackgroundApi';

import ProviderApiBase from './ProviderApiBase';
import ProviderApiEthereum from './ProviderApiEthereum';
import ProviderApiPrivate from './ProviderApiPrivate';

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
    // near
    // conflux
    // solana
    // sollet
  };

  return backgroundProviders;
}

export { createBackgroundProviders };
