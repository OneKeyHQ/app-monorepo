/* eslint-disable new-cap, @typescript-eslint/require-await */
import {
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_APTOS,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_DOGE,
  IMPL_EVM,
  IMPL_LTC,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_SUI,
  IMPL_TBTC,
  IMPL_TRON,
  IMPL_XRP,
} from '../constants';
import { OneKeyInternalError } from '../errors';
import { getNetworkImpl } from '../managers/network';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import VaultAda from './impl/ada/Vault';
import VaultHelperAda from './impl/ada/VaultHelper';
import VaultAlgo from './impl/algo/Vault';
import VaultHelperAlgo from './impl/algo/VaultHelper';
import VaultAptos from './impl/apt/Vault';
import VaultHelperAptos from './impl/apt/VaultHelper';
import VaultBch from './impl/bch/Vault';
import VaultHelperBch from './impl/bch/VaultHelper';
import VaultBtc from './impl/btc/Vault';
import VaultHelperBtc from './impl/btc/VaultHelper';
import VaultCfx from './impl/cfx/Vault';
import VaultHelperCfx from './impl/cfx/VaultHelper';
import VaultCosmos from './impl/cosmos/Vault';
import VaultHelperCosmos from './impl/cosmos/VaultHelper';
import VaultDoge from './impl/doge/Vault';
import VaultHelperDoge from './impl/doge/VaultHelper';
import VaultEvm from './impl/evm/Vault';
import VaultHelperEvm from './impl/evm/VaultHelper';
import VaultLtc from './impl/ltc/Vault';
import VaultHelperLtc from './impl/ltc/VaultHelper';
import VaultNear from './impl/near/Vault';
import VaultHelperNear from './impl/near/VaultHelper';
import VaultSol from './impl/sol/Vault';
import VauleHelperSol from './impl/sol/VaultHelper';
import VaultStc from './impl/stc/Vault';
import VaultHelperStc from './impl/stc/VaultHelper';
import VaultSui from './impl/sui/Vault';
import VaultHelperSui from './impl/sui/VaultHelper';
import VaultTbtc from './impl/tbtc/Vault';
import VaultHelperTbtc from './impl/tbtc/VaultHelper';
import VaultTron from './impl/tron/Vault';
import VaultHelperTron from './impl/tron/VaultHelper';
import VaultXrp from './impl/xrp/Vault';
import VaultHelperXrp from './impl/xrp/VaultHelper';
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
  if (impl === IMPL_TBTC) {
    return new VaultHelperTbtc(options);
  }
  if (impl === IMPL_STC) {
    return new VaultHelperStc(options);
  }
  if (impl === IMPL_SOL) {
    return new VauleHelperSol(options);
  }
  if (impl === IMPL_TRON) {
    return new VaultHelperTron(options);
  }
  if (impl === IMPL_APTOS) {
    return new VaultHelperAptos(options);
  }
  if (impl === IMPL_DOGE) {
    return new VaultHelperDoge(options);
  }
  if (impl === IMPL_LTC) {
    return new VaultHelperLtc(options);
  }
  if (impl === IMPL_ALGO) {
    return new VaultHelperAlgo(options);
  }
  if (impl === IMPL_BCH) {
    return new VaultHelperBch(options);
  }
  if (impl === IMPL_XRP) {
    return new VaultHelperXrp(options);
  }
  if (impl === IMPL_COSMOS) {
    return new VaultHelperCosmos(options);
  }
  if (impl === IMPL_ADA) {
    return new VaultHelperAda(options);
  }
  if (impl === IMPL_SUI) {
    return new VaultHelperSui(options);
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
  if (network.impl === IMPL_TBTC) {
    vault = new VaultTbtc(options);
  }
  if (network.impl === IMPL_STC) {
    vault = new VaultStc(options);
  }
  if (network.impl === IMPL_SOL) {
    vault = new VaultSol(options);
  }
  if (network.impl === IMPL_TRON) {
    vault = new VaultTron(options);
  }
  if (network.impl === IMPL_APTOS) {
    vault = new VaultAptos(options);
  }
  if (network.impl === IMPL_DOGE) {
    vault = new VaultDoge(options);
  }
  if (network.impl === IMPL_LTC) {
    vault = new VaultLtc(options);
  }
  if (network.impl === IMPL_ALGO) {
    vault = new VaultAlgo(options);
  }
  if (network.impl === IMPL_BCH) {
    vault = new VaultBch(options);
  }
  if (network.impl === IMPL_XRP) {
    vault = new VaultXrp(options);
  }
  if (network.impl === IMPL_COSMOS) {
    vault = new VaultCosmos(options);
  }
  if (network.impl === IMPL_ADA) {
    vault = new VaultAda(options);
  }
  if (network.impl === IMPL_SUI) {
    vault = new VaultSui(options);
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
