import { IMPL_EVM } from './constants';
import { networkIsPreset, presetNetworks } from './presets';
import { AddEVMNetworkParams, DBNetwork, Network } from './types/network';

function getEVMNetworkToCreate(params: AddEVMNetworkParams): DBNetwork {
  // TODO: chain interaction to check rpc url works correctly. Get network id and chain id.
  const chainId = '0-0';
  const id = `${IMPL_EVM}--${chainId}`;
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
  };
}

function fromDBNetworkToNetwork(dbNetwork: DBNetwork): Network {
  const isPresetNetwork = networkIsPreset(dbNetwork.id);
  const presetRpcURLs = isPresetNetwork
    ? (presetNetworks.get(dbNetwork.id) || { presetRpcURLs: [] }).presetRpcURLs
    : [];
  return {
    ...dbNetwork,
    preset: isPresetNetwork,
    presetRpcURLs,
  };
}

export { getEVMNetworkToCreate, fromDBNetworkToNetwork };
