import { EDecodedTxActionType } from '../../types/tx';

import {
  composeTrayAccountChange24h,
  formatTrayPendingTxAmount,
  getTrayPendingTxAmountInfo,
  getTrayPendingTxType,
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

  test('formats zero amount without reserved decimal zeros', () => {
    const result = formatTrayPendingTxAmount({
      firstSend: { amount: '0', symbol: 'ETH' },
    });
    expect(result).toBe('0 ETH');
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

describe('getTrayPendingTxAmountInfo', () => {
  test('uses token approve amount before transfer amount', () => {
    const result = getTrayPendingTxAmountInfo({
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        amount: '12.34',
        symbol: 'USDT',
      },
      assetTransfer: {
        sends: [{ amount: '0.1', symbol: 'ETH' }],
      },
    } as never);

    expect(result).toEqual({ amount: '12.34', symbol: 'USDT' });
  });

  test('falls back to received amount when there is no send amount', () => {
    const result = getTrayPendingTxAmountInfo({
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        receives: [{ amount: '0.25', symbol: 'ATOM' }],
      },
    } as never);

    expect(result).toEqual({ amount: '0.25', symbol: 'ATOM' });
  });
});

describe('getTrayPendingTxType', () => {
  test('classifies function calls as contract transactions', () => {
    expect(
      getTrayPendingTxType({
        action: { type: EDecodedTxActionType.FUNCTION_CALL } as never,
      }),
    ).toBe('contract');
  });

  test('classifies asset transfers to contracts as contract transactions', () => {
    expect(
      getTrayPendingTxType({
        decodedTx: { isToContract: true } as never,
        action: { type: EDecodedTxActionType.ASSET_TRANSFER } as never,
      }),
    ).toBe('contract');
  });
});

describe('composeTrayAccountChange24h', () => {
  test('returns undefined until a real 24h source is wired', () => {
    // Documents the deliberate gap left by OK-53612 partial fix. When a
    // backend feed arrives, replace this test with the new behavior.
    expect(composeTrayAccountChange24h()).toBeUndefined();
  });
});
