/* eslint-disable new-cap, @typescript-eslint/require-await */
import {
  IMPL_BTC,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
} from '../constants';
import { OneKeyInternalError } from '../errors';
import { getNetworkImpl } from '../managers/network';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import VaultBtc from './impl/btc/Vault';
import VaultHelperBtc from './impl/btc/VaultHelper';
import VaultCfx from './impl/cfx/Vault';
import VaultHelperCfx from './impl/cfx/VaultHelper';
import VaultEvm from './impl/evm/Vault';
import VaultHelperEvm from './impl/evm/VaultHelper';
import VaultNear from './impl/near/Vault';
import VaultHelperNear from './impl/near/VaultHelper';
import VaultSol from './impl/sol/Vault';
import VauleHelperSol from './impl/sol/VaultHelper';
import VaultStc from './impl/stc/Vault';
import VaultHelperStc from './impl/stc/VaultHelper';
import { VaultHelperBase } from './VaultHelperBase';

import type { KeyringBase } from './keyring/KeyringBase';
import type { IVaultFactoryOptions, IVaultOptions } from './types';
import type { VaultBase } from './VaultBase';

export function createVaultHelperInstance(
  options: IVaultFactoryOptions,
): VaultHelperBase {
  const impl = getNetworkImpl(options.networkId);
  if (impl === IMPL_EVM) {
    return new VaultHelperEvm(options);
  }
  if (impl === IMPL_NEAR) {
    return new VaultHelperNear(options);
  }
  if (impl === IMPL_CFX) {
    return new VaultHelperCfx(options);
  }
  if (impl === IMPL_BTC) {
    return new VaultHelperBtc(options);
  }
  if (impl === IMPL_STC) {
    return new VaultHelperStc(options);
  }
  if (impl === IMPL_SOL) {
    return new VauleHelperSol(options);
  }
  throw new OneKeyInternalError(
    `VaultHelper Class not found for: networkId=${options.networkId}, accountId=${options.accountId}`,
  );
}

export async function createKeyringInstance(vault: VaultBase) {
  const { walletId } = vault;

  let keyring: KeyringBase | null = null;

  // TODO dbAccount type: "simple"
  if (walletId.startsWith('hd-')) {
    keyring = new vault.keyringMap.hd(vault);
  }
  if (walletId.startsWith('hw-')) {
    keyring = new vault.keyringMap.hw(vault);
  }
  if (walletId === WALLET_TYPE_WATCHING) {
    keyring = new vault.keyringMap.watching(vault);
  }
  if (walletId === WALLET_TYPE_EXTERNAL) {
    keyring = new vault.keyringMap.external(vault);
  }
  if (walletId === WALLET_TYPE_IMPORTED) {
    keyring = new vault.keyringMap.imported(vault);
  }

  if (!keyring) {
    throw new OneKeyInternalError(
      `Keyring Class not found for: walletId=${walletId}`,
    );
  }
  return keyring;
}

export async function createVaultInstance(options: IVaultOptions) {
  const { engine } = options;
  const network = await engine.getNetwork(options.networkId);
  // TODO read from cache
  let vault: VaultBase | null = null;

  if (network.impl === IMPL_EVM) {
    // TODO remove ts ignore
    // @ts-ignore
    vault = new VaultEvm(options);
  }
  if (network.impl === IMPL_NEAR) {
    vault = new VaultNear(options);
  }
  if (network.impl === IMPL_CFX) {
    vault = new VaultCfx(options);
  }
  if (network.impl === IMPL_BTC) {
    vault = new VaultBtc(options);
  }
  if (network.impl === IMPL_STC) {
    vault = new VaultStc(options);
  }
  if (network.impl === IMPL_SOL) {
    vault = new VaultSol(options);
  }
  if (!vault) {
    throw new OneKeyInternalError(
      `Vault Class not found for: networkId=${options.networkId}, accountId=${options.accountId}`,
    );
  }

  vault.helper = createVaultHelperInstance(options);

  await vault.init({
    keyringCreator: createKeyringInstance,
  });
  // TODO save to cache
  return vault;
}
