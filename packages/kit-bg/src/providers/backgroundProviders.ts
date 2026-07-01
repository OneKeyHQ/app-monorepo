import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import ProviderApiPrivate from './ProviderApiPrivate';

import type ProviderApiBase from './ProviderApiBase';
import type {
  IBackgroundApi,
  IBackgroundApiBridge,
} from '../apis/IBackgroundApi';

export type IProviderApiModule = {
  default: new (props: {
    backgroundApi: IBackgroundApiBridge | IBackgroundApi;
  }) => ProviderApiBase;
};

// Per-chain ProviderApi async loaders.
//
// Why import() (not require()): a static-string require() bundles the target
// module — and its heavy chain SDK — into the INITIAL (web) / startup (native)
// graph even when wrapped in a lazy getter, because webpack/Metro treat sync
// require as a build-time dependency. import() instead emits a webpack async
// chunk (web) / a lazy split-bundle segment (native, see
// apps/mobile/plugins/asyncRequireCore.js + bundle-groups.config.js), so a
// chain's ProviderApi + SDK only loads when a dapp actually invokes that chain.
// Mirrors the cross-platform-proven vaults/factory.ts vaultsLoader pattern.
export const providerApiLoaders: Partial<
  Record<IInjectedProviderNames, () => Promise<IProviderApiModule>>
> = {
  [IInjectedProviderNames.ethereum]: () => import('./ProviderApiEthereum'),
  [IInjectedProviderNames.solana]: () => import('./ProviderApiSolana'),
  [IInjectedProviderNames.near]: () => import('./ProviderApiNear'),
  [IInjectedProviderNames.aptos]: () => import('./ProviderApiAptos'),
  [IInjectedProviderNames.conflux]: () => import('./ProviderApiConflux'),
  [IInjectedProviderNames.tron]: () => import('./ProviderApiTron'),
  [IInjectedProviderNames.algo]: () => import('./ProviderApiAlgo'),
  [IInjectedProviderNames.sui]: () => import('./ProviderApiSui'),
  [IInjectedProviderNames.bfc]: () => import('./ProviderApiBfc'),
  [IInjectedProviderNames.ton]: () => import('./ProviderApiTon'),
  [IInjectedProviderNames.alephium]: () => import('./ProviderApiAlph'),
  [IInjectedProviderNames.scdo]: () => import('./ProviderApiScdo'),
  [IInjectedProviderNames.cardano]: () => import('./ProviderApiCardano'),
  [IInjectedProviderNames.cosmos]: () => import('./ProviderApiCosmos'),
  [IInjectedProviderNames.polkadot]: () => import('./ProviderApiPolkadot'),
  [IInjectedProviderNames.webln]: () => import('./ProviderApiWebln'),
  [IInjectedProviderNames.nostr]: () => import('./ProviderApiNostr'),
  [IInjectedProviderNames.btc]: () => import('./ProviderApiBtc'),
  [IInjectedProviderNames.neo]: () => import('./ProviderApiNeoN3'),
  [IInjectedProviderNames.stellar]: () => import('./ProviderApiStellar'),
};

// $private stays EAGER: it is accessed SYNCHRONOUSLY by name in several places
// (ProviderApiNear, ServiceDApp, ServiceContextMenu, ServiceSetting), so it must
// always be present on backgroundApi.providers. All other providers are loaded
// lazily via BackgroundApiBase.getProviderApi(scope).
function createBackgroundProviders({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApiBridge | IBackgroundApi;
}): Partial<Record<IInjectedProviderNames, ProviderApiBase>> {
  return {
    [IInjectedProviderNames.$private]: new ProviderApiPrivate({
      backgroundApi,
    }),
  };
}

export { createBackgroundProviders };
