import {
  parseXmrPreparedTransaction,
  parseXmrTransaction,
} from './transactionReview';

function transaction() {
  return {
    from: 'sender',
    to: 'recipient',
    amount: '18446744.073709551615',
    amountAtomic: '18446744073709551615',
    feeAtomic: '30000000',
    changeAtomic: '0',
    priority: 'normal',
    isMaxSend: true,
    chainTip: 3_767_827,
    signableHex: 'aabb',
    inputCount: 2,
  };
}

describe('Monero transaction review boundary', () => {
  it('preserves a u64 amount above the JS safe integer range exactly', () => {
    expect(parseXmrTransaction(transaction()).amountAtomic).toBe(
      '18446744073709551615',
    );
  });
  it.each(['18446744073709551616', '01', '-1', '1.5', '1e12'])(
    'rejects invalid atomic amount %s',
    (amountAtomic) => {
      expect(() =>
        parseXmrPreparedTransaction({ ...transaction(), amountAtomic }),
      ).toThrow();
    },
  );
  it('rejects a display amount that differs by one atomic unit', () => {
    expect(() =>
      parseXmrTransaction({
        ...transaction(),
        amount: '18446744.073709551614',
      }),
    ).toThrow();
  });
  it.each([0, 1.5, 1025, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid input count %s',
    (inputCount) => {
      expect(() =>
        parseXmrTransaction({ ...transaction(), inputCount }),
      ).toThrow();
    },
  );
  it('creates a snapshot before asynchronous confirmation or signing', () => {
    const original = transaction();
    const snapshot = parseXmrTransaction(original);
    original.to = 'changed';
    original.amountAtomic = '1';
    expect(snapshot.to).toBe('recipient');
    expect(snapshot.amountAtomic).toBe('18446744073709551615');
  });
});
