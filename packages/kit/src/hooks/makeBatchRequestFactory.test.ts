import { makeBatchRequestFactory } from './makeBatchRequestFactory';

type IRound = { networkId: string };
const batch = {
  accountId: 'a',
  apiAddress: '0x',
  accountXpub: undefined,
  items: [{ networkId: 'evm--1' }, { networkId: 'evm--2' }],
};

describe('makeBatchRequestFactory', () => {
  it('feeds every defined item result and returns them', async () => {
    const settled = jest.fn();
    const request = jest.fn(async () => [
      { networkId: 'evm--1' },
      undefined,
      { networkId: 'evm--2' },
    ]);
    const factory = makeBatchRequestFactory<IRound, typeof batch>({
      batch,
      allNetworkRequestsBatch: request,
      onRequestSettled: settled,
      runGeneration: 7,
      getAllNetworkDataInit: () => true,
    });
    await expect(factory()).resolves.toEqual([
      { networkId: 'evm--1' },
      { networkId: 'evm--2' },
    ]);
    expect(request).toHaveBeenCalledWith({ batch, allNetworkDataInit: true });
    expect(settled.mock.calls).toEqual([
      [{ networkId: 'evm--1' }, 7],
      [{ networkId: 'evm--2' }, 7],
    ]);
  });

  it('reads allNetworkDataInit at execution time and tolerates an empty response', async () => {
    let init = false;
    const request = jest.fn(async () => []);
    const factory = makeBatchRequestFactory<IRound, typeof batch>({
      batch,
      allNetworkRequestsBatch: request,
      runGeneration: 1,
      getAllNetworkDataInit: () => init,
    });
    init = true;
    await expect(factory()).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith({ batch, allNetworkDataInit: true });
  });
});
