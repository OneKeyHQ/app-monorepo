/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import evmTokenList from '@sushiswap/default-token-list';

import { PresetNetwork } from '../types/network';
import { Token } from '../types/token';

import _presetNetworks from './networks.json';

// TODO: update from remote config?

const presetNetworks: Record<string, PresetNetwork> = {};
const presetTokens: Record<string, Record<string, Token>> = {};

_presetNetworks.forEach((network: PresetNetwork) => {
  presetNetworks[network.id] = network;
  presetTokens[network.id] = {};
});

evmTokenList.tokens.forEach((t) => {
  const chainId = t.chainId.toString();
  const networkId = `evm--${chainId}-${chainId}`;
  if (typeof presetTokens[networkId] === 'undefined') {
    presetTokens[networkId] = {};
  }
  const tokenAddress = t.address.toLowerCase();
  const token: Token = {
    id: '',
    name: t.name,
    networkId,
    tokenIdOnNetwork: tokenAddress,
    symbol: t.symbol,
    decimals: t.decimals,
    logoURI: t.logoURI || '',
  };
  presetTokens[networkId][tokenAddress] = token;
});

function networkIsPreset(networkId: string): boolean {
  return typeof presetNetworks[networkId] !== 'undefined';
}

function getPresetToken(networkId: string, tokenIdOnNetwork: string): Token {
  return (
    (presetTokens[networkId] || {})[tokenIdOnNetwork] || {
      id: `${networkId}--${tokenIdOnNetwork}`,
      name: tokenIdOnNetwork.slice(0, 4),
      networkId,
      tokenIdOnNetwork,
      symbol: tokenIdOnNetwork.slice(0, 4),
      decimals: -1,
      logoURI: '',
    }
  );
}

function getPresetTokensOnNetwork(networkId: string): Array<Token> {
  return Object.values(presetTokens[networkId] || {});
}

export {
  presetNetworks,
  networkIsPreset,
  getPresetToken,
  getPresetTokensOnNetwork,
};
