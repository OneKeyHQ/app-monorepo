import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import simpleDb from '../dbs/simple/simpleDb';

import type { PresetNetwork } from '../types/network';

//  network.id => PresetNetwork
let presetNetworks: Record<string, PresetNetwork> = {};

export const formatServerNetworkToPresetNetwork = (
  network: IServerNetwork,
): PresetNetwork => {
  const urls = network.rpcURLs?.map((rpc) => rpc.url) ?? [];
  return {
    id: network.id,
    impl: network.impl,
    name: network.name,
    symbol: network.symbol,
    decimals: network.decimals,
    logoURI: network.logoURI,
    enabled: !network.isTestnet && network.defaultEnabled,
    chainId: network.chainId,
    shortCode: network.shortcode,
    shortName: network.shortname,
    isTestnet: network.isTestnet,
    feeSymbol: network.feeMeta.symbol,
    feeDecimals: network.feeMeta.decimals,
    balance2FeeDecimals: network.balance2FeeDecimals,
    rpcURLs: network.rpcURLs,
    prices: network.priceConfigs,
    explorers: network.explorers,
    extensions: network.extensions,
    presetRpcURLs: urls.length > 0 ? urls : [''],
    clientApi: network.clientApi,
    status: network.status,
  };
};

async function initNetworkList() {
  const record: Record<string, PresetNetwork> = {};

  const serverUpdatedNetworks =
    await simpleDb.serverNetworks.getServerNetworks();

  const { serverPresetNetworks } = await import(
    '@onekeyhq/shared/src/config/presetNetworks'
  );

  serverPresetNetworks.concat(serverUpdatedNetworks).forEach((s) => {
    try {
      const network = formatServerNetworkToPresetNetwork(s);
      record[network.id] = network;
    } catch (error) {
      debugLogger.common.error(`[initNetworkList] error`, s);
    }
  });
  presetNetworks = record;
}

function getPresetNetworks(): Record<string, PresetNetwork> {
  return presetNetworks;
}

function networkIsPreset(networkId: string): boolean {
  return typeof presetNetworks[networkId] !== 'undefined';
}

export { networkIsPreset, getPresetNetworks, initNetworkList };
