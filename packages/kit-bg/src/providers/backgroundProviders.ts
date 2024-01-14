import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

// import ProviderAlgo from './ProviderAlgo';
// import ProviderApiAptos from './ProviderApiAptos';
// import ProviderApiBtc from './ProviderApiBtc';
// import ProviderApiCardano from './ProviderApiCardano';
// import ProviderApiConflux from './ProviderApiConflux';
// import ProviderApiCosmos from './ProviderApiCosmos';
import ProviderApiEthereum from './ProviderApiEthereum';
// import ProviderApiNear from './ProviderApiNear';
// import ProviderApiPolkadot from './ProviderApiPolkadot';
// import ProviderApiPrivate from './ProviderApiPrivate';
// import ProviderApiSolana from './ProviderApiSolana';
// import ProviderApiStarcoin from './ProviderApiStarcoin';
// import ProviderApiSui from './ProviderApiSui';
// import ProviderApiTron from './ProviderApiTron';
import ProviderApiWebln from './ProviderApiWebln';

import type ProviderApiBase from './ProviderApiBase';
import type {
  IBackgroundApi,
  IBackgroundApiBridge,
} from '../apis/IBackgroundApi';

function createBackgroundProviders({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApiBridge | IBackgroundApi;
}) {
  const backgroundProviders: Record<string, ProviderApiBase> = {
    // [IInjectedProviderNames.$private]: new ProviderApiPrivate({
    //   backgroundApi,
    // }),
    [IInjectedProviderNames.ethereum]: new ProviderApiEthereum({
      backgroundApi,
    }),
    // [IInjectedProviderNames.solana]: new ProviderApiSolana({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.starcoin]: new ProviderApiStarcoin({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.near]: new ProviderApiNear({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.aptos]: new ProviderApiAptos({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.conflux]: new ProviderApiConflux({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.tron]: new ProviderApiTron({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.algo]: new ProviderAlgo({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.sui]: new ProviderApiSui({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.cardano]: new ProviderApiCardano({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.cosmos]: new ProviderApiCosmos({
    //   backgroundApi,
    // }),
    // [IInjectedProviderNames.polkadot]: new ProviderApiPolkadot({
    //   backgroundApi,
    // }),
    [IInjectedProviderNames.webln]: new ProviderApiWebln({ backgroundApi }),
    // [IInjectedProviderNames.btc]: new ProviderApiBtc({
    //   backgroundApi,
    // }),
    // near
    // eslint-disable-next-line spellcheck/spell-checker
    // sollet
  };

  return backgroundProviders;
}

export { createBackgroundProviders };
