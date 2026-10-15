import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import { getVaultSettings } from './settings';

/**
 * **Regression.** The chain selector loads vault settings for every network in
 * one `Promise.all` (`ServiceNetwork._getNetworkVaultSettingsByNetworkIds`).
 * `Promise.all` rejects as a whole, so a single network whose settings fail to
 * load does not go missing by itself -- it empties the entire network list.
 *
 * That is what shipping Monero into the preset list exposed: before it was
 * listed its settings were never loaded on this path, so nothing noticed.
 */
describe('every preset network can load its vault settings', () => {
  const networks = getPresetNetworks();

  it.each(networks.map((n) => [n.id] as const))('%s', async (networkId) => {
    await expect(getVaultSettings({ networkId })).resolves.toBeTruthy();
  });
});
