import { PresetNetwork } from '../types/network';

import _presetNetworks from './networks.json';

// TODO: update from remote config?

const presetNetworks: Map<string, PresetNetwork> = new Map();
_presetNetworks.forEach((network: PresetNetwork) => {
  presetNetworks.set(network.id, network);
});

function networkIsPreset(networkId: string): boolean {
  return presetNetworks.has(networkId);
}

export { presetNetworks, networkIsPreset };
