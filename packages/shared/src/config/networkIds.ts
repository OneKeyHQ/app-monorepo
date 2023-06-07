import { serverPresetNetworks } from './presetNetworks';

export const OnekeyNetwork = serverPresetNetworks.reduce((memo, n) => {
  memo[n.shortcode] = n.id;
  return memo;
}, {} as Record<string, string>);
