/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { PresetNetwork } from '../types/network';
import { Token } from '../types/token';

import _presetNetworks from './networks.json';

// TODO: update from remote config?

const presetNetworks: Map<string, PresetNetwork> = new Map();
_presetNetworks.forEach((network: PresetNetwork) => {
  presetNetworks.set(network.id, network);
});

function networkIsPreset(networkId: string): boolean {
  return presetNetworks.has(networkId);
}

function getPresetTokensOnNetwork(_networkId: string): Array<Token> {
  // TODO
  return [];
}

export { presetNetworks, networkIsPreset, getPresetTokensOnNetwork };
