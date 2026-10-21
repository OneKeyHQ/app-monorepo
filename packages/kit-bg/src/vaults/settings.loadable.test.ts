import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import { getVaultSettings } from './settings';

// The chain selector loads all vault settings in one `Promise.all`, so one
// failing network empties the entire network list.
describe('every preset network can load its vault settings', () => {
  const networks = getPresetNetworks();

  it.each(networks.map((n) => [n.id] as const))('%s', async (networkId) => {
    await expect(getVaultSettings({ networkId })).resolves.toBeTruthy();
  });
});
