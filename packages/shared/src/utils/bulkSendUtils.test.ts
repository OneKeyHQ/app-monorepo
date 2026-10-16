import bulkSendUtils from './bulkSendUtils';

const { chunkBulkSendTransfers } = bulkSendUtils;

describe('chunkBulkSendTransfers', () => {
  const makeTransfers = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ to: `addr-${i}` }));

  it('returns no chunks for an empty list', () => {
    expect(chunkBulkSendTransfers([], 200)).toEqual([]);
  });

  it('keeps a single chunk when no limit is configured', () => {
    const transfers = makeTransfers(500);
    expect(chunkBulkSendTransfers(transfers)).toEqual([transfers]);
    expect(chunkBulkSendTransfers(transfers, 0)).toEqual([transfers]);
  });

  it.each([
    [1, [1]],
    [200, [200]],
    [201, [200, 1]],
    [500, [200, 200, 100]],
  ])('splits %i transfers into chunk sizes %j', (count, sizes) => {
    const transfers = makeTransfers(count);
    const chunks = chunkBulkSendTransfers(transfers, 200);
    expect(chunks.map((c) => c.length)).toEqual(sizes);
    expect(chunks.flat()).toEqual(transfers);
  });
});
