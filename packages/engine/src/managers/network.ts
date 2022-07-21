import { IMPL_EVM, IMPL_STC, SEPERATOR } from '../constants';
import { OneKeyInternalError } from '../errors';
import { getPresetNetworks, networkIsPreset } from '../presets';
import {
  AddEVMNetworkParams,
  BlockExplorer,
  DBNetwork,
  Network,
} from '../types/network';
import { IVaultSettings } from '../vaults/types';

import { getAccountNameInfoByImpl } from './impl';

function getEVMNetworkToCreate(
  id: string,
  params: AddEVMNetworkParams,
): DBNetwork {
  return {
    id,
    name: params.name || id,
    impl: IMPL_EVM,
    symbol: params.symbol || 'ETH',
    logoURI: '',
    enabled: true,
    feeSymbol: 'Gwei',
    decimals: 18,
    feeDecimals: 9,
    balance2FeeDecimals: 9,
    rpcURL: params.rpcURL,
    position: 0,
    explorerURL: params.explorerURL,
  };
}

function generateEIP3091(customExplorerURL?: string):
  | {
      name: string;
      address: string;
      block: string;
      transaction: string;
    }
  | undefined {
  if (!customExplorerURL) {
    return;
  }
  try {
    const u = new URL(customExplorerURL);
    const base = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;

    u.pathname = `${base}address/{address}`;
    const address = u.toString().replace('%7Baddress%7D', '{address}');

    u.pathname = `${base}block/{block}`;
    const block = u.toString().replace('%7Bblock%7D', '{block}');

    u.pathname = `${base}transaction/{transaction}`;
    const transaction = u
      .toString()
      .replace('%7Btransaction%7D', '{transaction}');
    return {
      name: customExplorerURL,
      address,
      block,
      transaction,
    };
  } catch (error) {
    console.log(error);
  }
}

function fromDBNetworkToNetwork(
  dbNetwork: DBNetwork,
  settings: IVaultSettings,
): Network {
  const { position, curve, ...forNetwork } = dbNetwork;
  const preset = networkIsPreset(dbNetwork.id);
  let shortName = dbNetwork.name;
  let shortCode = '';
  let isTestnet = false;
  let firstExplorer;
  let matchedExplorer;
  if (preset) {
    const presetNetwork = getPresetNetworks()[dbNetwork.id];
    shortName = presetNetwork.shortName || shortName;
    shortCode = presetNetwork.shortCode;
    isTestnet = presetNetwork.isTestnet || false;

    [firstExplorer] = presetNetwork.explorers || [];
    if (dbNetwork.explorerURL) {
      matchedExplorer = (presetNetwork.explorers || []).find(
        (e) => e.name === dbNetwork.explorerURL,
      );
    }
  }

  const { name, ...blockExplorerURL } = matchedExplorer ||
    generateEIP3091(dbNetwork.explorerURL) ||
    firstExplorer || {
      name: '',
      address: '',
      block: '',
      transaction: '',
    };

  let extraInfo = {};
  if (dbNetwork.impl === IMPL_EVM || dbNetwork.impl === IMPL_STC) {
    const chainId = parseInt(dbNetwork.id.split(SEPERATOR)[1]);
    extraInfo = {
      chainId: `0x${chainId.toString(16)}`,
      networkVersion: chainId.toString(),
    };
  }
  return {
    ...forNetwork,
    shortName,
    shortCode,
    preset,
    isTestnet,
    // The two display decimals fields below are for UI, hard-coded for now.
    // TODO: define display decimals in remote config and give defaults for different implementations.
    nativeDisplayDecimals: 6,
    tokenDisplayDecimals: 4,
    // extra info for dapp interactions
    extraInfo,
    accountNameInfo: getAccountNameInfoByImpl(dbNetwork.impl),
    blockExplorerURL: { name, ...blockExplorerURL } as BlockExplorer,
    settings,
  };
}

function getImplFromNetworkId(networkId: string): string {
  if (!networkId) {
    throw new OneKeyInternalError(
      'getImplFromNetworkId ERROR: networkId required',
    );
  }
  const [impl, chainId] = networkId.split(SEPERATOR);
  if (impl && chainId) {
    return impl;
  }
  throw new OneKeyInternalError(`Invalid networkId ${networkId}.`);
}

export { getEVMNetworkToCreate, fromDBNetworkToNetwork, getImplFromNetworkId };
