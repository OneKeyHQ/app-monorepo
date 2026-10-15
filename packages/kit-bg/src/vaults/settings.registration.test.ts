import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { getVaultSettingsImpls } from './settings';

/**
 * Impls that deliberately have no network of their own.
 *
 * Listed one by one rather than loosening the assertion: a real chain that
 * goes missing must not be able to hide behind a broad exemption.
 */
const IMPLS_WITHOUT_A_NETWORK = new Set([
  // Internal pseudo-impl. It has vault settings so the factory can resolve
  // one, but it represents an aggregation rather than a chain, so there is
  // nothing for the network selector to show.
  'aggregate',
]);

/**
 * Adding a chain means touching several hand-maintained registries, and
 * missing one of them does not fail to compile -- it fails as the chain simply
 * not being there.
 *
 * Monero shipped with a vault, a keyring, a core chain API and an entry in
 * `presetNetworksMap`, but not in the array `getPresetNetworks()` returns.
 * Every id-keyed lookup worked and the whole test suite passed; the network
 * just could not be found in the app. This pins the one invariant that would
 * have caught it.
 */
describe('vault registration', () => {
  it('gives every chain that has a vault at least one network to select', () => {
    const networkImpls = new Set(
      getPresetNetworks().map((network) =>
        networkUtils.getNetworkImpl({ networkId: network.id }),
      ),
    );

    const withoutNetwork = getVaultSettingsImpls().filter(
      (impl) => !networkImpls.has(impl) && !IMPLS_WITHOUT_A_NETWORK.has(impl),
    );

    expect(withoutNetwork).toEqual([]);
  });
});
