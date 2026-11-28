import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { shouldDeriveCardanoForWalletSession } from './hardwareWalletSessionUtils';

describe('shouldDeriveCardanoForWalletSession', () => {
  const networkIdsMap = getNetworkIdsMap();

  it('returns true when selected networkId is Cardano', () => {
    expect(
      shouldDeriveCardanoForWalletSession({
        networkId: networkIdsMap.ada,
      }),
    ).toBe(true);
  });

  it('returns true when customNetworks contains Cardano', () => {
    expect(
      shouldDeriveCardanoForWalletSession({
        networkId: networkIdsMap.onekeyall,
        customNetworks: [
          { networkId: networkIdsMap.eth },
          { networkId: networkIdsMap.ada },
        ],
      }),
    ).toBe(true);
  });

  it('returns false for non-Cardano networks', () => {
    expect(
      shouldDeriveCardanoForWalletSession({
        networkId: networkIdsMap.btc,
        customNetworks: [{ networkId: networkIdsMap.eth }],
      }),
    ).toBe(false);
  });

  it('returns false when networkId is all-networks or omitted', () => {
    expect(
      shouldDeriveCardanoForWalletSession({
        networkId: networkIdsMap.onekeyall,
      }),
    ).toBe(false);
    expect(shouldDeriveCardanoForWalletSession({})).toBe(false);
  });
});
