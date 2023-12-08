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
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import { createVaultSettings } from './factory.createVaultSettings';
import VaultHelperAda from './impl/ada/VaultHelper';
import VaultHelperAlgo from './impl/algo/VaultHelper';
import VaultHelperAllNetworks from './impl/allnetworks/VaultHelper';
import VaultHelperAptos from './impl/apt/VaultHelper';
import VaultHelperBch from './impl/bch/VaultHelper';
import VaultHelperBtc from './impl/btc/VaultHelper';
import VaultHelperCfx from './impl/cfx/VaultHelper';
import VaultHelperCosmos from './impl/cosmos/VaultHelper';
import VaultHelperDoge from './impl/doge/VaultHelper';
import VaultHelperDot from './impl/dot/VaultHelper';
import VaultHelperEvm from './impl/evm/VaultHelper';
import VaultHelperFil from './impl/fil/VaultHelper';
import VaultHelperKaspa from './impl/kaspa/VaultHelper';
import VaultHelperLightning from './impl/lightning-network/VaultHelper';
import VaultHelperLtc from './impl/ltc/VaultHelper';
import VaultHelperNear from './impl/near/VaultHelper';
import VaultHelperNexa from './impl/nexa/VaultHelper';
import VaultHelperNostr from './impl/nostr/VaultHelper';
import VauleHelperSol from './impl/sol/VaultHelper';
import VaultHelperStc from './impl/stc/VaultHelper';
import VaultHelperSui from './impl/sui/VaultHelper';
import VaultHelperTbtc from './impl/tbtc/VaultHelper';
import VaultHelperTron from './impl/tron/VaultHelper';
import VaultHelperXmr from './impl/xmr/VaultHelper';
import VaultHelperXrp from './impl/xrp/VaultHelper';

import type { KeyringBase } from './keyring/KeyringBase';
import type { IVaultFactoryOptions, IVaultOptions } from './types';
import type { VaultBase } from './VaultBase';
import type { VaultHelperBase } from './VaultHelperBase';

export async function createVaultHelperInstance(
  options: IVaultFactoryOptions,
): Promise<VaultHelperBase> {
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
  if (impl === IMPL_FIL) {
    return new VaultHelperFil(options);
  }
  if (impl === IMPL_DOT) {
    return new VaultHelperDot(options);
  }
  if (impl === IMPL_XMR) {
    return new VaultHelperXmr(options);
  }
  if (impl === IMPL_KASPA) {
    return new VaultHelperKaspa(options);
  }
  if (impl === IMPL_NEXA) {
    return new VaultHelperNexa(options);
  }
  if (impl === IMPL_LIGHTNING || impl === IMPL_LIGHTNING_TESTNET) {
    return new VaultHelperLightning(options);
  }
  if (impl === IMPL_ALLNETWORKS) {
    return new VaultHelperAllNetworks(options);
  }
  if (impl === IMPL_NOSTR) {
    return new VaultHelperNostr(options);
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
    const VaultEvm = (await import('./impl/evm/Vault')).default;
    vault = new VaultEvm(options);
  }
  if (network.impl === IMPL_NEAR) {
    const VaultNear = (await import('./impl/near/Vault')).default;
    vault = new VaultNear(options);
  }
  if (network.impl === IMPL_CFX) {
    const VaultCfx = (await import('./impl/cfx/Vault')).default;
    vault = new VaultCfx(options);
  }
  if (network.impl === IMPL_BTC) {
    const VaultBtc = (await import('./impl/btc/Vault')).default;
    vault = new VaultBtc(options);
  }
  if (network.impl === IMPL_TBTC) {
    const VaultTbtc = (await import('./impl/tbtc/Vault')).default;
    vault = new VaultTbtc(options);
  }
  if (network.impl === IMPL_STC) {
    const VaultStc = (await import('./impl/stc/Vault')).default;
    vault = new VaultStc(options);
  }
  if (network.impl === IMPL_SOL) {
    const VaultSol = (await import('./impl/sol/Vault')).default;
    vault = new VaultSol(options);
  }
  if (network.impl === IMPL_TRON) {
    const VaultTron = (await import('./impl/tron/Vault')).default;
    vault = new VaultTron(options);
  }
  if (network.impl === IMPL_APTOS) {
    const VaultAptos = (await import('./impl/apt/Vault')).default;
    vault = new VaultAptos(options);
  }
  if (network.impl === IMPL_DOGE) {
    const VaultDoge = (await import('./impl/doge/Vault')).default;
    vault = new VaultDoge(options);
  }
  if (network.impl === IMPL_LTC) {
    const VaultLtc = (await import('./impl/ltc/Vault')).default;
    vault = new VaultLtc(options);
  }
  if (network.impl === IMPL_ALGO) {
    const VaultAlgo = (await import('./impl/algo/Vault')).default;
    vault = new VaultAlgo(options);
  }
  if (network.impl === IMPL_BCH) {
    const VaultBch = (await import('./impl/bch/Vault')).default;
    vault = new VaultBch(options);
  }
  if (network.impl === IMPL_XRP) {
    const VaultXrp = (await import('./impl/xrp/Vault')).default;
    vault = new VaultXrp(options);
  }
  if (network.impl === IMPL_COSMOS) {
    const VaultCosmos = (await import('./impl/cosmos/Vault')).default;
    vault = new VaultCosmos(options);
  }
  if (network.impl === IMPL_ADA) {
    const VaultAda = (await import('./impl/ada/Vault')).default;
    vault = new VaultAda(options);
  }
  if (network.impl === IMPL_SUI) {
    const VaultSui = (await import('./impl/sui/Vault')).default;
    vault = new VaultSui(options);
  }
  if (network.impl === IMPL_FIL) {
    const VaultFil = (await import('./impl/fil/Vault')).default;
    vault = new VaultFil(options);
  }
  if (network.impl === IMPL_DOT) {
    const VaultDot = (await import('./impl/dot/Vault')).default;
    vault = new VaultDot(options);
  }
  if (network.impl === IMPL_XMR) {
    const VaultXmr = (await import('./impl/xmr/Vault')).default;
    vault = new VaultXmr(options);
  }
  if (network.impl === IMPL_KASPA) {
    const VaultKaspa = (await import('./impl/kaspa/Vault')).default;
    vault = new VaultKaspa(options);
  }
  if (network.impl === IMPL_NEXA) {
    const VaultNexa = (await import('./impl/nexa/Vault')).default;
    vault = new VaultNexa(options);
  }
  if (
    network.impl === IMPL_LIGHTNING ||
    network.impl === IMPL_LIGHTNING_TESTNET
  ) {
    const VaultLightning = (await import('./impl/lightning-network/Vault'))
      .default;
    vault = new VaultLightning(options);
  }
  if (network.impl === IMPL_ALLNETWORKS) {
    const VaultAllNetworks = (await import('./impl/allnetworks/Vault')).default;
    vault = new VaultAllNetworks(options);
  }
  if (network.impl === IMPL_NOSTR) {
    const VaultNostr = (await import('./impl/nostr/Vault')).default;
    vault = new VaultNostr(options);
  }
  if (!vault) {
    throw new OneKeyInternalError(
      `Vault Class not found for: networkId=${options.networkId}, accountId=${options.accountId}`,
    );
  }

  vault.helper = await createVaultHelperInstance(options);
  const settings = createVaultSettings(options);
  if (!Object.isFrozen(settings)) {
    throw new Error(
      `VaultSettings should be frozen, please use Object.freeze() >>>> networkId=${options.networkId}, accountId=${options.accountId}`,
    );
  }
  vault.settings = settings;

  await vault.init({
    keyringCreator: createKeyringInstance,
  });
  // TODO save to cache
  return vault;
}
