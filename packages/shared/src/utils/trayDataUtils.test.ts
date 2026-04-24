import {
  composeTrayAccountChange24h,
  formatTrayPendingTxAmount,
} from './trayDataUtils';

describe('formatTrayPendingTxAmount', () => {
  test('formats asset transfer with standard amount and symbol', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '1.2345', symbol: 'ETH' },
    });
    expect(result).toBe('1.2345 ETH');
  });

  test('uses 3 significant figures for sub-cent amounts', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '0.000123456', symbol: 'ETH' },
    });
    expect(result).toBe('0.000123 ETH');
  });

  test('trims trailing zeros for 4-decimal amounts', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '1.5000', symbol: 'USDC' },
    });
    expect(result).toBe('1.5 USDC');
  });

  test('formats zero amount via 3 significant figures (documents sub-cent branch behavior)', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '0', symbol: 'ETH' },
    });
    expect(result).toBe('0.00 ETH');
  });

  test('returns em dash when no firstSend (approve/contract/send/swap all pass through here)', () => {
    // PendingTransactions renders the i18n'd typeLabel on a separate row;
    // this field should stay neutral so we never duplicate an English label
    // next to a translated one. Never show totalFeeFiatValue — that was
    // OK-53607's bug.
    expect(formatTrayPendingTxAmount({ firstSend: undefined })).toBe('—');
  });

  test('falls back to raw string when amount is not a valid number', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: 'not-a-number', symbol: 'ETH' },
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
