import {
  composeTrayAccountChange24h,
  formatTrayPendingTxAmount,
} from './trayDataUtils';

describe('formatTrayPendingTxAmount', () => {
  test('formats asset transfer with standard amount and symbol', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '1.2345', symbol: 'ETH' },
      txType: 'send',
    });
    expect(result).toBe('1.2345 ETH');
  });

  test('uses 3 significant figures for sub-cent amounts', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '0.000123456', symbol: 'ETH' },
      txType: 'send',
    });
    expect(result).toBe('0.000123 ETH');
  });

  test('trims trailing zeros for 4-decimal amounts', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '1.5000', symbol: 'USDC' },
      txType: 'send',
    });
    expect(result).toBe('1.5 USDC');
  });

  test('returns approve-specific label when no firstSend and txType is approve', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: undefined,
      txType: 'approve',
    });
    expect(result).toBe('Approve');
  });

  test('formats zero amount via 3 significant figures (documents sub-cent branch behavior)', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '0', symbol: 'ETH' },
      txType: 'send',
    });
    expect(result).toBe('0.00 ETH');
  });

  test('returns contract-call label when no firstSend and txType is contract', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: undefined,
      txType: 'contract',
    });
    expect(result).toBe('Contract');
  });

  test('returns em dash when no firstSend and txType is send (defensive)', () => {
    // NEVER show totalFeeFiatValue here — that was OK-53607's bug.
    const result = formatTrayPendingTxAmount({
      firstSend: undefined,
      txType: 'send',
    });
    expect(result).toBe('—');
  });

  test('returns em dash when no firstSend and txType is swap (defensive)', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: undefined,
      txType: 'swap',
    });
    expect(result).toBe('—');
  });

  test('falls back to raw string when amount is not a valid number', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: 'not-a-number', symbol: 'ETH' },
      txType: 'send',
    });
    expect(result).toBe('not-a-number ETH');
  });
});

describe('composeTrayAccountChange24h', () => {
  test('returns undefined until a real 24h source is wired', () => {
    // Documents the deliberate gap left by OK-53612 partial fix. When a
    // backend feed arrives, replace this test with the new behavior.
    expect(composeTrayAccountChange24h()).toBeUndefined();
  });
});
