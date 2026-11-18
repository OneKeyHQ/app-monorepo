import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { getVaultSettings, getVaultSettingsImpls } from './settings';

// Impls that deliberately have no network, listed one by one so a missing
// real chain cannot hide behind a broad exemption.
const IMPLS_WITHOUT_A_NETWORK = new Set([
  // Aggregation pseudo-impl, not a selectable chain.
  'aggregate',
]);

// A chain in `presetNetworksMap` but missing from `getPresetNetworks()` still
// compiles and passes id-keyed lookups, yet never appears in the app.
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

  // The UI asks before settings load, so a new privacy chain must be listed there too.
  it('lists exactly the chains with a local wallet as local-wallet networks', async () => {
    const networkIdByImpl = new Map(
      getPresetNetworks().map((network) => [
        networkUtils.getNetworkImpl({ networkId: network.id }),
        network.id,
      ]),
    );
    const networkIds = [...networkIdByImpl.values()];
    const hasLocalWallet = await Promise.all(
      networkIds.map(async (networkId) =>
        Boolean((await getVaultSettings({ networkId })).localWallet),
      ),
    );
    const mismatched = networkIds.filter(
      (networkId, index) =>
        hasLocalWallet[index] !==
        networkUtils.isLocalWalletNetwork({ networkId }),
    );
    expect(mismatched).toEqual([]);
  });
});
