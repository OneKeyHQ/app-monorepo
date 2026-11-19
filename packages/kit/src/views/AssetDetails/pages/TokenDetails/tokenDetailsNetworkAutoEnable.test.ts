import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { enableNetworkInAllNetworksOnce } from './tokenDetailsNetworkAutoEnable';

// Not in the default-enabled preset set, so only `enabledNetworks` governs it.
const networkId = 'evm--999999';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('enableNetworkInAllNetworksOnce (OK-61863)', () => {
  it('enables a network the live state reports as disabled', async () => {
    const enableNetwork = jest.fn(async () => {});

    const enabled = await enableNetworkInAllNetworksOnce({
      networkId,
      inFlightNetworkIds: new Set(),
      getAllNetworksState: async () => ({
        disabledNetworks: {},
        enabledNetworks: {},
      }),
      enableNetwork,
    });

    expect(enabled).toBe(true);
    expect(enableNetwork).toHaveBeenCalledTimes(1);
    expect(enableNetwork).toHaveBeenCalledWith(networkId);
  });

  it('consults the live state instead of a render snapshot', async () => {
    const enableNetwork = jest.fn(async () => {});

    // A stale snapshot would still say "disabled" here; the live read says
    // an earlier tab switch already enabled it, so nothing must happen.
    const enabled = await enableNetworkInAllNetworksOnce({
      networkId,
      inFlightNetworkIds: new Set(),
      getAllNetworksState: async () => ({
        disabledNetworks: {},
        enabledNetworks: { [networkId]: true },
      }),
      enableNetwork,
    });

    expect(enabled).toBe(false);
    expect(enableNetwork).not.toHaveBeenCalled();
  });

  it('collapses overlapping calls for the same network into one enable', async () => {
    const stateRead = createDeferred<{
      disabledNetworks: Record<string, boolean>;
      enabledNetworks: Record<string, boolean>;
    }>();
    const enableNetwork = jest.fn(async () => {});
    const inFlightNetworkIds = new Set<string>();
    const params = {
      networkId,
      inFlightNetworkIds,
      getAllNetworksState: () => stateRead.promise,
      enableNetwork,
    };

    const first = enableNetworkInAllNetworksOnce(params);
    const second = enableNetworkInAllNetworksOnce(params);
    stateRead.resolve({ disabledNetworks: {}, enabledNetworks: {} });

    await expect(Promise.all([first, second])).resolves.toEqual([true, false]);
    expect(enableNetwork).toHaveBeenCalledTimes(1);
    expect(inFlightNetworkIds.size).toBe(0);
  });

  it('releases the in-flight marker when the enable call throws', async () => {
    const inFlightNetworkIds = new Set<string>();

    await expect(
      enableNetworkInAllNetworksOnce({
        networkId,
        inFlightNetworkIds,
        getAllNetworksState: async () => ({
          disabledNetworks: {},
          enabledNetworks: {},
        }),
        enableNetwork: async () => {
          throw new OneKeyLocalError('boom');
        },
      }),
    ).rejects.toThrow('boom');

    expect(inFlightNetworkIds.size).toBe(0);
  });

  it('does not block a different network that is enabling concurrently', async () => {
    const stateRead = createDeferred<{
      disabledNetworks: Record<string, boolean>;
      enabledNetworks: Record<string, boolean>;
    }>();
    const enableNetwork = jest.fn(async () => {});
    const inFlightNetworkIds = new Set<string>();

    const first = enableNetworkInAllNetworksOnce({
      networkId,
      inFlightNetworkIds,
      getAllNetworksState: () => stateRead.promise,
      enableNetwork,
    });
    const second = enableNetworkInAllNetworksOnce({
      networkId: 'evm--888888',
      inFlightNetworkIds,
      getAllNetworksState: () => stateRead.promise,
      enableNetwork,
    });
    stateRead.resolve({ disabledNetworks: {}, enabledNetworks: {} });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(enableNetwork).toHaveBeenCalledTimes(2);
  });
});
