/* cspell:ignore Infini */
import {
  getPrimeInfiniPaymentWarningsFingerprint,
  hasUnconfirmedPrimeInfiniPaymentWarnings,
} from '@onekeyhq/shared/src/utils/primeInfiniPaymentWarnings';
import type { IPrimeInfiniPayment } from '@onekeyhq/shared/types/prime/primeTypes';

import { confirmPrimeInfiniPaymentWarnings } from './primeInfiniPaymentWarnings';

const payment: IPrimeInfiniPayment = {
  paymentId: 'payment-1',
  address: 'recipient',
  chain: 'BSC',
  token: 'USDT',
  amountDue: '29.99',
  expiresAt: 1_800_000_000_000,
};

describe('latest Infini payment warnings', () => {
  test.each([undefined, []])(
    'does not interrupt a payment with warnings=%p',
    async (warningMessages) => {
      const confirmWarnings = jest.fn(async () => true);
      await expect(
        confirmPrimeInfiniPaymentWarnings({
          payment: { ...payment, warningMessages },
          confirmWarnings,
          shouldContinue: () => true,
        }),
      ).resolves.toBe(true);
      expect(confirmWarnings).not.toHaveBeenCalled();
    },
  );

  test.each([true, false])(
    'continues only when warnings are confirmed (%s)',
    async (confirmed) => {
      const warningMessages = [
        'First warning',
        'Second warning',
        'First warning',
      ];
      const confirmWarnings = jest.fn<Promise<boolean>, [string[]]>(
        async () => confirmed,
      );
      await expect(
        confirmPrimeInfiniPaymentWarnings({
          payment: { ...payment, warningMessages },
          confirmWarnings,
          shouldContinue: () => true,
        }),
      ).resolves.toBe(confirmed);
      expect(confirmWarnings).toHaveBeenCalledWith(warningMessages);
      expect(confirmWarnings.mock.calls[0][0]).not.toBe(warningMessages);
    },
  );

  test('does not continue a flow that became stale while the warning was open', async () => {
    let isCurrent = true;
    await expect(
      confirmPrimeInfiniPaymentWarnings({
        payment: { ...payment, warningMessages: ['Warning'] },
        confirmWarnings: async () => {
          isCurrent = false;
          return true;
        },
        shouldContinue: () => isCurrent,
      }),
    ).resolves.toBe(false);
  });

  test('does not show a warning for an already abandoned flow', async () => {
    const confirmWarnings = jest.fn(async () => true);
    await expect(
      confirmPrimeInfiniPaymentWarnings({
        payment: { ...payment, warningMessages: ['Warning'] },
        confirmWarnings,
        shouldContinue: () => false,
      }),
    ).resolves.toBe(false);
    expect(confirmWarnings).not.toHaveBeenCalled();
  });

  test('requires renewed consent if the final background refresh adds or changes warnings', () => {
    const acknowledgedPayment = {
      ...payment,
      warningMessages: ['First', 'Second'],
    };
    const confirmedWarningsFingerprint =
      getPrimeInfiniPaymentWarningsFingerprint(acknowledgedPayment);
    expect(
      hasUnconfirmedPrimeInfiniPaymentWarnings({
        payment: acknowledgedPayment,
        confirmedWarningsFingerprint,
      }),
    ).toBe(false);
    expect(
      hasUnconfirmedPrimeInfiniPaymentWarnings({
        payment: { ...payment, warningMessages: ['Second', 'First'] },
        confirmedWarningsFingerprint,
      }),
    ).toBe(true);
    expect(
      hasUnconfirmedPrimeInfiniPaymentWarnings({
        payment: { ...payment, warningMessages: ['New warning'] },
        confirmedWarningsFingerprint,
      }),
    ).toBe(true);
    expect(
      hasUnconfirmedPrimeInfiniPaymentWarnings({
        payment,
        confirmedWarningsFingerprint,
      }),
    ).toBe(false);
    expect(
      hasUnconfirmedPrimeInfiniPaymentWarnings({
        payment: acknowledgedPayment,
      }),
    ).toBe(true);
  });
});
