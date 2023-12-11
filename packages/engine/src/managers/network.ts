import axios from 'axios';
import BigNumber from 'bignumber.js';
import qs from 'qs';

import { FAKE_ALL_NETWORK } from '@onekeyhq/shared/src/config/fakeNetwork';
import {
  IMPL_EVM,
  IMPL_STC,
  SEPERATOR,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { getFiatEndpoint } from '../endpoint';
import { getPresetNetworks, networkIsPreset } from '../presets';

import { getAccountNameInfoByImpl, implToCoinTypes } from './impl';
import { getNetworkImpl } from './network.utils';

import type {
  AddEVMNetworkParams,
  BlockExplorer,
  DBNetwork,
  Network,
} from '../types/network';
import type { IVaultSettings } from '../vaults/types';

export type ChainListConfig = {
  name?: string;
  title?: string;
  network?: string;
  chain: string;
  icon: string;
  rpc: string[];

  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  infoURL: string;
  shortName: string;
  chainId: number;
  networkId: number;
  slip44: number;
  ens: {
    registry: string;
  };
  explorers: {
    name: string;
    url: string;
    standard: string;
  }[];
  tvl: number;
  chainSlug: string;
  logoURI: string;
};

function getEVMNetworkToCreate(
  id: string,
  params: AddEVMNetworkParams,
): DBNetwork {
  return {
    id,
    name: params.name || id,
    impl: IMPL_EVM,
    symbol: params.symbol || 'ETH',
    logoURI: params.logoURI ?? '',
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

    // https://onekeyhq.atlassian.net/browse/OK-15390
    // https://onekeyhq.atlassian.net/browse/OK-18828
    // https://eips.ethereum.org/EIPS/eip-3091
    u.pathname = `${base}tx/{transaction}`;
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

    // In case of info updated
    forNetwork.name = presetNetwork.name ?? forNetwork.name;
    forNetwork.symbol = presetNetwork.symbol ?? forNetwork.symbol;
    forNetwork.logoURI = presetNetwork.logoURI ?? forNetwork.logoURI;
    forNetwork.clientApi = presetNetwork.clientApi || forNetwork.clientApi;

    // Default rpc URL
    forNetwork.rpcURL = forNetwork.rpcURL || presetNetwork.presetRpcURLs[0];

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

function parseNetworkId(networkId: string): {
  impl?: string;
  chainId?: string;
} {
  if (!networkId || !networkId.includes(SEPERATOR)) {
    throw new Error(`parseNetworkId ERROR: Invalid networkId -> ${networkId}`);
  }
  const [impl, chainId] = networkId.split(SEPERATOR);
  return {
    impl,
    chainId,
  };
}

function getChainIdFromNetworkId(networkId: string) {
  const [, chainId] = networkId.split(SEPERATOR);
  return chainId ?? '';
}

function getCoinTypeFromImpl(impl: string) {
  return implToCoinTypes[impl];
}

function getCoinTypeFromNetworkId(networkId: string) {
  const impl = getNetworkImpl(networkId);
  return getCoinTypeFromImpl(impl);
}

function generateNetworkIdByChainId({
  impl,
  chainId,
}: {
  impl: string;
  chainId: string | number;
}) {
  const chainIdNum = new BigNumber(chainId).toNumber();
  return `${impl}${SEPERATOR}${chainIdNum}`;
}

export const fetchChainList = async (params: {
  query: string;
  showTestNet: boolean;
  page: number;
  pageSize: number;
}) => {
  const endpoint = getFiatEndpoint();
  const { data } = await axios.get<ChainListConfig[]>(
    `${endpoint}/network/chainlist?${qs.stringify(params)}`,
  );
  return data;
};

export const isAllNetworks = (networkId?: string | null) =>
  networkId === FAKE_ALL_NETWORK.id;

export {
  getChainIdFromNetworkId,
  getNetworkImpl,
  getCoinTypeFromNetworkId,
  getCoinTypeFromImpl,
  getEVMNetworkToCreate,
  fromDBNetworkToNetwork,
  parseNetworkId,
  generateNetworkIdByChainId,
};
