/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { NetworkList, networkList } from '@onekeyfe/network-list';
import axios from 'axios';

import { PresetNetwork } from '../types/network';

import { REMOTE_URL, Version, checkVersion } from './base';

// TODO: desc order is expected in network list

const getPresetNetworkList = (): NetworkList => networkList;

let synced = false;
let preset = getPresetNetworkList();
//  network.id => PresetNetwork
let presetNetworks: Record<string, PresetNetwork> = {};

function initNetworkList(presetNetwork: NetworkList) {
  const record: Record<string, PresetNetwork> = {};

  presetNetwork.networks.forEach((network) => {
    const urls = network.rpcURLs?.map((rpc) => rpc.url) ?? [];

    const pn: PresetNetwork = {
      id: network.id,
      impl: network.impl,
      name: network.name,
      symbol: network.symbol,
      decimals: network.decimals,
      logoURI: network.logoURI,
      enabled: !network.isTestnet && network.enable,
      chainId: network.chainId,
      isTestnet: network.isTestnet,
      feeSymbol: network.fee.symbol,
      feeDecimals: network.fee.decimals,
      balance2FeeDecimals: network.balance2FeeDecimals,
      rpcURLs: network.rpcURLs,
      prices: network.prices,
      explorers: network.explorers,
      extensions: network.extensions,
      presetRpcURLs: urls.length > 0 ? urls : [''], // TODO: Update [''] for data consistency
    };
    record[network.id] = pn;
  });
  presetNetworks = record;
}

initNetworkList(preset);

async function syncNetworkList(ver: Version): Promise<NetworkList | null> {
  const newVer: string = await checkVersion(
    `${REMOTE_URL}/networklist/version`,
    ver,
  );
  if (newVer === '') {
    return null;
  }

  // from remote
  let remoteList: NetworkList;
  try {
    console.log('get remote network list...');
    const response = await axios.get<NetworkList>(
      `${REMOTE_URL}/networklist/onekey.networklist.json`,
    );
    remoteList = response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
  return remoteList;
}

async function syncLatestNetworkList() {
  if (synced) {
    return;
  }
  const newNetworkList = await syncNetworkList(preset.version);
  if (newNetworkList) {
    preset = networkList;
    initNetworkList(newNetworkList);
  }
  synced = true;
}

// sync from remote
(async () => {
  await syncLatestNetworkList();
})();

function getPresetNetworks(): Record<string, PresetNetwork> {
  return presetNetworks;
}

function networkIsPreset(networkId: string): boolean {
  return typeof presetNetworks[networkId] !== 'undefined';
}

export { networkIsPreset, getPresetNetworks };
