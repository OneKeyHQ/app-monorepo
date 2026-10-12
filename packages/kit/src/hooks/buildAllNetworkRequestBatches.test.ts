jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isEvmNetwork: ({ networkId }: { networkId: string }) =>
      networkId.startsWith('evm--'),
  },
}));

// eslint-disable-next-line import/first
import {
  buildAllNetworkRequestBatches,
  partitionAllNetworkRequestBatches,
} from './buildAllNetworkRequestBatches';

type IItem = {
  accountId: string;
  networkId: string;
  apiAddress: string;
  accountXpub?: string;
  isBackendIndexed?: boolean;
};

function evm(index: number, extra: Partial<IItem> = {}): IItem {
  return {
    accountId: 'hd-1--evm',
    networkId: `evm--${index}`,
    apiAddress: '0xabc',
    accountXpub: undefined,
    isBackendIndexed: true,
    ...extra,
  };
}

describe('buildAllNetworkRequestBatches', () => {
  it('groups EVM networks of one address into sorted chunks of at most 10', () => {
    const items = Array.from({ length: 12 }, (_, i) => evm(12 - i));
    const batches = buildAllNetworkRequestBatches(items);
    expect(batches).toHaveLength(2);
    expect(batches[0].items.map((i) => i.networkId)).toEqual([
      'evm--1',
      'evm--10',
      'evm--11',
      'evm--12',
      'evm--2',
      'evm--3',
      'evm--4',
      'evm--5',
      'evm--6',
      'evm--7',
    ]);
    expect(batches[1].items.map((i) => i.networkId)).toEqual([
      'evm--8',
      'evm--9',
    ]);
    expect(batches[0]).toMatchObject({
      accountId: 'hd-1--evm',
      apiAddress: '0xabc',
    });
  });

  it('is independent of input order', () => {
    const items = Array.from({ length: 23 }, (_, i) => evm(i + 1));
    const shuffled = [...items].toReversed();
    const a = buildAllNetworkRequestBatches(items).map((b) =>
      b.items.map((i) => i.networkId),
    );
    const b = buildAllNetworkRequestBatches(shuffled).map((batch) =>
      batch.items.map((i) => i.networkId),
    );
    expect(a).toEqual(b);
    expect(a.map((chunk) => chunk.length)).toEqual([10, 10, 3]);
  });

  it('keeps non-EVM networks and other addresses as single-item batches', () => {
    const items: IItem[] = [
      evm(1),
      {
        accountId: 'hd-1--sol',
        networkId: 'sol--101',
        apiAddress: 'So1',
        isBackendIndexed: true,
      },
      evm(2),
      {
        accountId: 'hd-1--btc',
        networkId: 'btc--0',
        apiAddress: 'bc1',
        accountXpub: 'xpub1',
        isBackendIndexed: false,
      },
    ];
    const batches = buildAllNetworkRequestBatches(items);
    expect(batches.map((b) => b.items.map((i) => i.networkId))).toEqual([
      ['evm--1', 'evm--2'],
      ['sol--101'],
      ['btc--0'],
    ]);
    expect(batches[2].accountXpub).toBe('xpub1');
  });

  it('drops placeholder rounds without account or address', () => {
    const items: IItem[] = [evm(1), evm(2, { accountId: '', apiAddress: '' })];
    const batches = buildAllNetworkRequestBatches(items);
    expect(batches).toHaveLength(1);
    expect(batches[0].items.map((i) => i.networkId)).toEqual(['evm--1']);
  });

  it('respects a custom batch size', () => {
    const items = [evm(1), evm(2), evm(3)];
    const batches = buildAllNetworkRequestBatches(items, { maxBatchSize: 2 });
    expect(batches.map((b) => b.items.length)).toEqual([2, 1]);
  });
});

describe('partitionAllNetworkRequestBatches', () => {
  it('puts batches with any backend-indexed item first', () => {
    const batches = buildAllNetworkRequestBatches(
      [
        evm(1),
        evm(2, { isBackendIndexed: false }),
        evm(3, { isBackendIndexed: false }),
        evm(4, { isBackendIndexed: false }),
      ],
      { maxBatchSize: 2 },
    );
    const { indexed, notIndexed } = partitionAllNetworkRequestBatches(batches);
    expect(indexed.map((b) => b.items.map((i) => i.networkId))).toEqual([
      ['evm--1', 'evm--2'],
    ]);
    expect(notIndexed.map((b) => b.items.map((i) => i.networkId))).toEqual([
      ['evm--3', 'evm--4'],
    ]);
  });
});
