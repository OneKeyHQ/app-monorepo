/* cspell:ignore Infini */
import {
  createPrimeInfiniPaymentValidationError,
  getPrimeInfiniPaymentErrorFailure,
  getPrimeInfiniPaymentValidationFailure,
  toPrimeInfiniPaymentPersistenceError,
} from './primeInfiniPaymentValidation';

import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentValidationFailure,
} from '../../types/prime/primeTypes';

const now = 1_800_000_000_000;
const asset = {
  key: 'BSC:USDT',
  chain: 'BSC',
  token: 'USDT',
  networkId: 'evm--56',
  contractAddress: '0xtoken',
};
const payment: IPrimeInfiniPayment = {
  paymentId: 'payment-1',
  address: '0xrecipient',
  chain: 'BSC',
  token: 'USDT',
  amountDue: '29.99',
  expiresAt: now + 60_000,
};

describe('Infini payment validation failures', () => {
  test.each<[number, IPrimeInfiniPaymentValidationFailure | undefined]>([
    [-1, 'quoteExpired'],
    [0, 'quoteExpired'],
    [1, 'quoteValidityTooShort'],
    [29_999, 'quoteValidityTooShort'],
    [30_000, 'quoteValidityTooShort'],
    [30_001, undefined],
  ])(
    'classifies a matching asset with %i ms remaining',
    (remainingMs, expected) => {
      expect(
        getPrimeInfiniPaymentValidationFailure({
          payment: { ...payment, expiresAt: now + remainingMs },
          asset,
          now,
        }),
      ).toBe(expected);
    },
  );

  test('distinguishes an asset mismatch from quote expiry', () => {
    expect(
      getPrimeInfiniPaymentValidationFailure({
        payment: {
          ...payment,
          chain: 'SOLANA',
          token: 'USDC',
          expiresAt: now - 1,
        },
        asset,
        now,
      }),
    ).toBe('assetMismatch');
    expect(
      createPrimeInfiniPaymentValidationError('assetMismatch', {
        expectedChain: 'BSC',
        expectedToken: 'USDT',
        actualChain: 'SOLANA',
        actualToken: 'USDC',
      }).message,
    ).toContain('Expected BSC/USDT, received SOLANA/USDC');
  });

  test.each<Partial<IPrimeInfiniPayment>>([
    { amountDue: '30' },
    { address: '0xother' },
    { expiresAt: now + 90_000 },
    { paymentId: 'payment-2' },
  ])(
    'requires another review when frozen transfer terms change: %p',
    (changes) => {
      expect(
        getPrimeInfiniPaymentValidationFailure({
          payment: { ...payment, ...changes },
          previousPayment: payment,
          asset,
          now,
        }),
      ).toBe('transferSnapshotChanged');
    },
  );

  test.each(['0', '-1', 'NaN', 'Infinity'])(
    'rejects invalid amounts without calling them an asset mismatch: %s',
    (amountDue) => {
      expect(
        getPrimeInfiniPaymentValidationFailure({
          payment: { ...payment, amountDue },
          asset,
          now,
        }),
      ).toBe('invalidResponse');
    },
  );

  test('can validate a tracking snapshot after quote expiry', () => {
    expect(
      getPrimeInfiniPaymentValidationFailure({
        payment: { ...payment, expiresAt: now - 1, amountConfirming: '1' },
        asset,
        now,
        validateQuote: false,
      }),
    ).toBeUndefined();
  });

  test.each<IPrimeInfiniPaymentValidationFailure>([
    'quoteExpired',
    'quoteValidityTooShort',
    'assetMismatch',
    'transferSnapshotChanged',
    'invalidResponse',
    'localPersistenceFailed',
  ])(
    'preserves %s across the main/bg error serialization boundary',
    (failure) => {
      const serialized =
        createPrimeInfiniPaymentValidationError(failure).serialize();
      expect(getPrimeInfiniPaymentErrorFailure(serialized)).toBe(failure);
    },
  );

  test('does not classify an API request failure as response validation', () => {
    expect(
      getPrimeInfiniPaymentErrorFailure(new Error('HTTP 503')),
    ).toBeUndefined();
    expect(
      getPrimeInfiniPaymentErrorFailure({
        data: { paymentValidationFailure: 'unknown' },
      }),
    ).toBeUndefined();
  });

  test('classifies storage failures without hiding a validation failure', () => {
    const failure = createPrimeInfiniPaymentValidationError(
      'transferSnapshotChanged',
    );
    expect(toPrimeInfiniPaymentPersistenceError(failure)).toBe(failure);
    expect(
      getPrimeInfiniPaymentErrorFailure(
        toPrimeInfiniPaymentPersistenceError(new Error('disk full')),
      ),
    ).toBe('localPersistenceFailed');
  });
});
