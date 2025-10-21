import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import ProviderApiPrivate from './ProviderApiPrivate';

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
    [IInjectedProviderNames.$private]: new ProviderApiPrivate({
      backgroundApi,
    }),
  };

  // Object.defineProperty(backgroundProviders, IInjectedProviderNames.$private, {
  //   get() {
  //     const ProviderApiPrivate = (
  //       require('./ProviderApiPrivate') as unknown as typeof import('./ProviderApiPrivate')
  //     ).default;
  //     const value = new ProviderApiPrivate({ backgroundApi });
  //     Object.defineProperty(this, IInjectedProviderNames.$private, { value });
  //     return value;
  //   },
  //   configurable: true,
  // });

  // Lazy load providers using getters

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.ethereum, {
    get() {
      const ProviderApiEthereum = (
        require('./ProviderApiEthereum') as unknown as typeof import('./ProviderApiEthereum')
      ).default;
      const value = new ProviderApiEthereum({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.ethereum, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.solana, {
    get() {
      const ProviderApiSolana = (
        require('./ProviderApiSolana') as unknown as typeof import('./ProviderApiSolana')
      ).default;
      const value = new ProviderApiSolana({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.solana, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.near, {
    get() {
      const ProviderApiNear = (
        require('./ProviderApiNear') as unknown as typeof import('./ProviderApiNear')
      ).default;
      const value = new ProviderApiNear({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.near, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.aptos, {
    get() {
      const ProviderApiAptos = (
        require('./ProviderApiAptos') as unknown as typeof import('./ProviderApiAptos')
      ).default;
      const value = new ProviderApiAptos({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.aptos, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.conflux, {
    get() {
      const ProviderApiConflux = (
        require('./ProviderApiConflux') as unknown as typeof import('./ProviderApiConflux')
      ).default;
      const value = new ProviderApiConflux({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.conflux, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.tron, {
    get() {
      const ProviderApiTron = (
        require('./ProviderApiTron') as unknown as typeof import('./ProviderApiTron')
      ).default;
      const value = new ProviderApiTron({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.tron, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.algo, {
    get() {
      const ProviderApiAlgo = (
        require('./ProviderApiAlgo') as unknown as typeof import('./ProviderApiAlgo')
      ).default;
      const value = new ProviderApiAlgo({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.algo, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.sui, {
    get() {
      const ProviderApiSui = (
        require('./ProviderApiSui') as unknown as typeof import('./ProviderApiSui')
      ).default;
      const value = new ProviderApiSui({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.sui, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.bfc, {
    get() {
      const ProviderApiBfc = (
        require('./ProviderApiBfc') as unknown as typeof import('./ProviderApiBfc')
      ).default;
      const value = new ProviderApiBfc({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.bfc, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.ton, {
    get() {
      const ProviderApiTon = (
        require('./ProviderApiTon') as unknown as typeof import('./ProviderApiTon')
      ).default;
      const value = new ProviderApiTon({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.ton, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.alephium, {
    get() {
      const ProviderApiAlph = (
        require('./ProviderApiAlph') as unknown as typeof import('./ProviderApiAlph')
      ).default;
      const value = new ProviderApiAlph({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.alephium, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.scdo, {
    get() {
      const ProviderApiScdo = (
        require('./ProviderApiScdo') as unknown as typeof import('./ProviderApiScdo')
      ).default;
      const value = new ProviderApiScdo({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.scdo, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.cardano, {
    get() {
      const ProviderApiCardano =
        require('./ProviderApiCardano') as unknown as typeof import('./ProviderApiCardano').default;
      const value = new ProviderApiCardano({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.cardano, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.cosmos, {
    get() {
      const ProviderApiCosmos = (
        require('./ProviderApiCosmos') as unknown as typeof import('./ProviderApiCosmos')
      ).default;
      const value = new ProviderApiCosmos({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.cosmos, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.polkadot, {
    get() {
      const ProviderApiPolkadot = (
        require('./ProviderApiPolkadot') as unknown as typeof import('./ProviderApiPolkadot')
      ).default;
      const value = new ProviderApiPolkadot({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.polkadot, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.webln, {
    get() {
      const ProviderApiWebln = (
        require('./ProviderApiWebln') as unknown as typeof import('./ProviderApiWebln')
      ).default;
      const value = new ProviderApiWebln({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.webln, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.nostr, {
    get() {
      const ProviderApiNostr = (
        require('./ProviderApiNostr') as unknown as typeof import('./ProviderApiNostr')
      ).default;
      const value = new ProviderApiNostr({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.nostr, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.btc, {
    get() {
      const ProviderApiBtc = (
        require('./ProviderApiBtc') as unknown as typeof import('./ProviderApiBtc')
      ).default;
      const value = new ProviderApiBtc({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.btc, { value });
      return value;
    },
    configurable: true,
  });

  Object.defineProperty(backgroundProviders, IInjectedProviderNames.neo, {
    get() {
      const ProviderApiNeoN3 = (
        require('./ProviderApiNeoN3') as unknown as typeof import('./ProviderApiNeoN3')
      ).default;
      const value = new ProviderApiNeoN3({ backgroundApi });
      Object.defineProperty(this, IInjectedProviderNames.neo, { value });
      return value;
    },
    configurable: true,
  });

  return backgroundProviders;
}

export { createBackgroundProviders };
