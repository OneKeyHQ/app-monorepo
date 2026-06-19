/**
 * Regression guard for Fix A: the COLD all-network fan-out must feed the
 * progressive-paint pipeline (`onRequestSettled`) per real network, exactly as
 * the WARM path does via the sliding-window `onSettled`. If this stops feeding,
 * a freshly-created account (no token cache → cold path) fetches data that never
 * reaches the progressive view, no structure frame is produced, and the home
 * token list is stuck on the skeleton forever.
 */
import {
  type IColdRequestNetworkInfo,
  makeColdRequestFactory,
} from './makeColdRequestFactory';

type IRound = { networkId: string; tokens: number };

const realNet = (networkId: string): IColdRequestNetworkInfo => ({
  accountId: `acc-${networkId}`,
  networkId,
  apiAddress: `addr-${networkId}`,
});

function setup(
  overrides: Partial<{
    networkInfo: IColdRequestNetworkInfo;
    result: IRound | undefined;
    runGeneration: number;
    allNetworkDataInit: boolean;
  }> = {},
) {
  const networkInfo = overrides.networkInfo ?? realNet('evm--1');
  const result =
    'result' in overrides
      ? overrides.result
      : { networkId: networkInfo.networkId, tokens: 3 };
  const allNetworkRequests = jest.fn(async () => result);
  const onRequestSettled = jest.fn();
  const onFed = jest.fn();
  const factory = makeColdRequestFactory<IRound>({
    networkInfo,
    allNetworkRequests,
    onRequestSettled,
    runGeneration: overrides.runGeneration ?? 7,
    getAllNetworkDataInit: () => overrides.allNetworkDataInit ?? false,
    onFed,
  });
  return { factory, allNetworkRequests, onRequestSettled, onFed, result };
}

describe('makeColdRequestFactory', () => {
  it('feeds onRequestSettled once with (result, generation) for a real network', async () => {
    const { factory, onRequestSettled, result } = setup({ runGeneration: 42 });
    const returned = await factory();

    expect(onRequestSettled).toHaveBeenCalledTimes(1);
    expect(onRequestSettled).toHaveBeenCalledWith(result, 42);
    // the raw result is returned unchanged so the caller's respTemp is intact
    expect(returned).toBe(result);
  });

  it('fires the onFed side-channel with the networkId for a real network', async () => {
    const { factory, onFed } = setup({ networkInfo: realNet('sol--101') });
    await factory();
    expect(onFed).toHaveBeenCalledTimes(1);
    expect(onFed).toHaveBeenCalledWith('sol--101');
  });

  it('does NOT feed a placeholder round with empty accountId', async () => {
    const { factory, onRequestSettled, onFed, result } = setup({
      networkInfo: { accountId: '', networkId: 'evm--1', apiAddress: 'addr' },
    });
    const returned = await factory();

    expect(onRequestSettled).not.toHaveBeenCalled();
    expect(onFed).not.toHaveBeenCalled();
    // still returns the result so the caller's accumulation is unaffected
    expect(returned).toBe(result);
  });

  it('does NOT feed a placeholder round with empty apiAddress', async () => {
    const { factory, onRequestSettled } = setup({
      networkInfo: { accountId: 'acc', networkId: 'evm--1', apiAddress: '' },
    });
    await factory();
    expect(onRequestSettled).not.toHaveBeenCalled();
  });

  it('does NOT feed when the fetch resolves null/undefined', async () => {
    const { factory, onRequestSettled, onFed } = setup({ result: undefined });
    const returned = await factory();

    expect(onRequestSettled).not.toHaveBeenCalled();
    expect(onFed).not.toHaveBeenCalled();
    expect(returned).toBeUndefined();
  });

  it('reads allNetworkDataInit at EXECUTION time (not factory-build time)', async () => {
    let init = false;
    const allNetworkRequests = jest.fn(async () => ({
      networkId: 'evm--1',
      tokens: 1,
    }));
    const factory = makeColdRequestFactory<IRound>({
      networkInfo: realNet('evm--1'),
      allNetworkRequests,
      onRequestSettled: jest.fn(),
      runGeneration: 1,
      getAllNetworkDataInit: () => init,
    });

    init = true; // flip AFTER the factory is built
    await factory();

    expect(allNetworkRequests).toHaveBeenCalledWith({
      accountId: 'acc-evm--1',
      networkId: 'evm--1',
      allNetworkDataInit: true,
    });
  });

  it('feeds exactly the real networks when a mixed batch is mapped through it (both batches use one factory)', async () => {
    const onRequestSettled = jest.fn();
    // mirrors the hook: backendIndexed ∪ backendNotIndexed, including a
    // placeholder (`includingNonExistingAccount`) that must be skipped.
    const batch: IColdRequestNetworkInfo[] = [
      realNet('evm--1'),
      realNet('btc--0'),
      { accountId: '', networkId: 'evm--999', apiAddress: '' }, // placeholder
      realNet('sol--101'),
    ];
    const factories = batch.map((networkInfo) =>
      makeColdRequestFactory<IRound>({
        networkInfo,
        allNetworkRequests: async () => ({
          networkId: networkInfo.networkId,
          tokens: 1,
        }),
        onRequestSettled,
        runGeneration: 5,
        getAllNetworkDataInit: () => false,
      }),
    );

    await Promise.all(factories.map((fn) => fn()));

    expect(onRequestSettled).toHaveBeenCalledTimes(3); // placeholder skipped
    const fedNetworks = onRequestSettled.mock.calls.map(
      ([r]) => (r as IRound).networkId,
    );
    expect(fedNetworks.toSorted()).toEqual(['btc--0', 'evm--1', 'sol--101']);
  });
});
