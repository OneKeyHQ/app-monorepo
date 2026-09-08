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
const fallbackWarningMessages = ['First mock warning', 'Second mock warning'];

describe('latest Infini payment warnings', () => {
  test.each([{ warningMessages: undefined }, { warningMessages: [] }])(
    'does not interrupt a payment with warnings=$warningMessages',
    async ({ warningMessages }) => {
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

  test('uses server warnings instead of the enabled fallback', async () => {
    const warningMessages = ['First API warning', 'Second API warning'];
    const confirmWarnings = jest.fn(async () => true);
    await expect(
      confirmPrimeInfiniPaymentWarnings({
        payment: { ...payment, warningMessages },
        fallbackWarningMessages,
        confirmWarnings,
        shouldContinue: () => true,
      }),
    ).resolves.toBe(true);
    expect(confirmWarnings).toHaveBeenCalledWith(warningMessages);
  });

  test.each([{ warningMessages: undefined }, { warningMessages: [] }])(
    'confirms the fallback without changing an API snapshot with warnings=$warningMessages',
    async ({ warningMessages }) => {
      const snapshot = { ...payment, warningMessages };
      const fingerprint = getPrimeInfiniPaymentWarningsFingerprint(snapshot);
      const confirmWarnings = jest.fn<Promise<boolean>, [string[]]>(
        async () => true,
      );

      await expect(
        confirmPrimeInfiniPaymentWarnings({
          payment: snapshot,
          fallbackWarningMessages,
          confirmWarnings,
          shouldContinue: () => true,
        }),
      ).resolves.toBe(true);

      expect(confirmWarnings).toHaveBeenCalledWith(fallbackWarningMessages);
      expect(confirmWarnings.mock.calls[0][0]).not.toBe(
        fallbackWarningMessages,
      );
      expect(snapshot.warningMessages).toBe(warningMessages);
      expect(getPrimeInfiniPaymentWarningsFingerprint(snapshot)).toBe(
        fingerprint,
      );
    },
  );

  test('cancelling fallback warnings stops checkout even without an invoice', async () => {
    const confirmWarnings = jest.fn(async () => false);
    await expect(
      confirmPrimeInfiniPaymentWarnings({
        payment: {},
        fallbackWarningMessages,
        confirmWarnings,
        shouldContinue: () => true,
      }),
    ).resolves.toBe(false);
    expect(confirmWarnings).toHaveBeenCalledWith(fallbackWarningMessages);
  });

  test.each([{ warningMessages: ['Warning'] }, { warningMessages: undefined }])(
    'does not continue a stale flow after confirming warnings=$warningMessages',
    async ({ warningMessages }) => {
      let isCurrent = true;
      await expect(
        confirmPrimeInfiniPaymentWarnings({
          payment: { ...payment, warningMessages },
          fallbackWarningMessages,
          confirmWarnings: async () => {
            isCurrent = false;
            return true;
          },
          shouldContinue: () => isCurrent,
        }),
      ).resolves.toBe(false);
    },
  );

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

  test('still requires consent for server warnings arriving after mock confirmation', async () => {
    const snapshot = { ...payment };
    const confirmedWarningsFingerprint =
      getPrimeInfiniPaymentWarningsFingerprint(snapshot);
    await expect(
      confirmPrimeInfiniPaymentWarnings({
        payment: snapshot,
        fallbackWarningMessages,
        confirmWarnings: async () => true,
        shouldContinue: () => true,
      }),
    ).resolves.toBe(true);

    expect(
      hasUnconfirmedPrimeInfiniPaymentWarnings({
        payment: { ...snapshot, warningMessages: ['New API warning'] },
        confirmedWarningsFingerprint,
      }),
    ).toBe(true);
  });
});
