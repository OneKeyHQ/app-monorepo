import bulkSendUtils from './bulkSendUtils';

const { chunkBulkSendTransfers, getBulkSendTxCount } = bulkSendUtils;

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
    expect(getBulkSendTxCount(count, 200)).toBe(sizes.length);
  });

  it('counts a single tx when no limit is configured', () => {
    expect(getBulkSendTxCount(0, 200)).toBe(0);
    expect(getBulkSendTxCount(500)).toBe(1);
  });
});
