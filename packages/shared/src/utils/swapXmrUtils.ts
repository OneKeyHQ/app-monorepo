import { presetNetworksMap } from '../config/presetNetworks';

export function isXmrSwapNetwork(networkId?: string) {
  return networkId === presetNetworksMap.xmr.id;
}

export function isXmrSwapProvider(provider: string) {
  return provider === 'SwapChangelly' || provider === 'SwapRocketX';
}

export function hasXmrMainnetPrimaryAddressShape(
  address?: string,
): address is string {
  return Boolean(address && /^4[1-9A-HJ-NP-Za-km-z]{94}$/.test(address));
}
