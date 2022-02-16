import { IMPL_EVM, SEPERATOR } from '../constants';
import { OneKeyInternalError } from '../errors';
import { getPresetNetworks, networkIsPreset } from '../presets';
import { AddEVMNetworkParams, DBNetwork, Network } from '../types/network';

function getEVMNetworkToCreate(params: AddEVMNetworkParams): DBNetwork {
  // TODO: chain interaction to check rpc url works correctly. Get network id and chain id.
  const chainId = '0';
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
  const presetNetworks = getPresetNetworks();
  const preset = isPresetNetwork
    ? presetNetworks[dbNetwork.id] || { presetRpcURLs: [], isTestnet: false }
    : { presetRpcURLs: [], isTestnet: false };
  return {
    ...dbNetwork,
    preset: isPresetNetwork,
    ...preset,
    // The two display decimals fields below are for UI, hard-coded for now.
    // TODO: define display decimals in remote config and give defaults for different implementations.
    nativeDisplayDecimals: 6,
    tokenDisplayDecimals: 4,
  };
}

function getImplFromNetworkId(networkId: string): string {
  const [impl, chainId] = networkId.split(SEPERATOR);
  if (impl && chainId) {
    return impl;
  }
  throw new OneKeyInternalError(`Invalid networkId ${networkId}.`);
}

export { getEVMNetworkToCreate, fromDBNetworkToNetwork, getImplFromNetworkId };
