/* eslint-disable new-cap, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-member-access */
import {
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_ALLNETWORKS,
  IMPL_APTOS,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_DOGE,
  IMPL_DOT,
  IMPL_EVM,
  IMPL_FIL,
  IMPL_KASPA,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_LTC,
  IMPL_NEAR,
  IMPL_NERVOS,
  IMPL_NEURAI,
  IMPL_NEXA,
  IMPL_NOSTR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_SUI,
  IMPL_TBTC,
  IMPL_TRON,
  IMPL_XMR,
  IMPL_XRP,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../errors';
import { getNetworkImpl } from '../managers/network.utils';

import type { IVaultSettings } from './types';

export function createVaultSettings(options: {
  networkId?: string;
  impl?: string;
}): IVaultSettings {
  if (!options.impl && !options.networkId) {
    throw new Error('networkId and impl require at least one parameter');
  }
  let { impl } = options;
  if (options.networkId) {
    impl = getNetworkImpl(options.networkId);
  }

  if (impl === IMPL_EVM) {
    return require('./impl/evm/settings').default as IVaultSettings;
  }
  if (impl === IMPL_NEAR) {
    return require('./impl/near/settings').default as IVaultSettings;
  }
  if (impl === IMPL_CFX) {
    return require('./impl/cfx/settings').default as IVaultSettings;
  }
  if (impl === IMPL_BTC) {
    return require('./impl/btc/settings').default as IVaultSettings;
  }
  if (impl === IMPL_TBTC) {
    return require('./impl/tbtc/settings').default as IVaultSettings;
  }
  if (impl === IMPL_STC) {
    return require('./impl/stc/settings').default as IVaultSettings;
  }
  if (impl === IMPL_SOL) {
    return require('./impl/sol/settings').default as IVaultSettings;
  }
  if (impl === IMPL_TRON) {
    return require('./impl/tron/settings').default as IVaultSettings;
  }
  if (impl === IMPL_APTOS) {
    return require('./impl/apt/settings').default as IVaultSettings;
  }
  if (impl === IMPL_DOGE) {
    return require('./impl/doge/settings').default as IVaultSettings;
  }
  if (impl === IMPL_LTC) {
    return require('./impl/ltc/settings').default as IVaultSettings;
  }
  if (impl === IMPL_ALGO) {
    return require('./impl/algo/settings').default as IVaultSettings;
  }
  if (impl === IMPL_BCH) {
    return require('./impl/bch/settings').default as IVaultSettings;
  }
  if (impl === IMPL_XRP) {
    return require('./impl/xrp/settings').default as IVaultSettings;
  }
  if (impl === IMPL_COSMOS) {
    return require('./impl/cosmos/settings').default as IVaultSettings;
  }
  if (impl === IMPL_ADA) {
    return require('./impl/ada/settings').default as IVaultSettings;
  }
  if (impl === IMPL_SUI) {
    return require('./impl/sui/settings').default as IVaultSettings;
  }
  if (impl === IMPL_FIL) {
    return require('./impl/fil/settings').default as IVaultSettings;
  }
  if (impl === IMPL_DOT) {
    return require('./impl/dot/settings').default as IVaultSettings;
  }
  if (impl === IMPL_XMR) {
    return require('./impl/xmr/settings').default as IVaultSettings;
  }
  if (impl === IMPL_KASPA) {
    return require('./impl/kaspa/settings').default as IVaultSettings;
  }
  if (impl === IMPL_NEXA) {
    return require('./impl/nexa/settings').default as IVaultSettings;
  }
  if (impl === IMPL_LIGHTNING) {
    return require('./impl/lightning-network/settings')
      .default as IVaultSettings;
  }
  if (impl === IMPL_LIGHTNING_TESTNET) {
    return require('./impl/lightning-network/settings-testnet')
      .default as IVaultSettings;
  }
  if (impl === IMPL_ALLNETWORKS) {
    return require('./impl/allnetworks/settings').default as IVaultSettings;
  }
  if (impl === IMPL_NOSTR) {
    return require('./impl/nostr/settings').default as IVaultSettings;
  }
  if (impl === IMPL_NERVOS) {
    return require('./impl/nervos/settings').default as IVaultSettings;
  }
  if (impl === IMPL_NEURAI) {
    return require('./impl/neurai/settings').default as IVaultSettings;
  }
  throw new OneKeyInternalError(
    `VaultSettings not found for: networkId=${options.networkId ?? ''}, impl=${
      impl ?? ''
    }`,
  );
}
