import { isAppleExistingSubscriptionPurchaseResult } from './primeStoreExistingSubscription';

const startedAtMs = Date.parse('2026-10-10T12:00:00.000Z');
const second = 1000;
const minute = 60 * second;
const day = 24 * 60 * minute;
const at = (offsetMs: number) => new Date(startedAtMs + offsetMs).toISOString();

describe('isAppleExistingSubscriptionPurchaseResult', () => {
  it.each([
    {
      name: 'detects an existing subscription returned by StoreKit',
      purchaseDate: at(-20 * day),
      requestDate: at(30 * second),
      expected: true,
    },
    {
      name: 'treats a transaction charged during the attempt as new',
      purchaseDate: at(40 * second),
      requestDate: at(45 * second),
      expected: false,
    },
    {
      // Device clock 1h ahead; Apple and RevenueCat agree the charge is new.
      name: 'ignores a device clock that alone is ahead',
      purchaseDate: at(-60 * minute + 40 * second),
      requestDate: at(-60 * minute + 45 * second),
      expected: false,
    },
    {
      name: 'ignores a receipt post that alone is slow',
      purchaseDate: at(40 * second),
      requestDate: at(10 * minute),
      expected: false,
    },
    {
      name: 'falls back without a transaction',
      purchaseDate: undefined,
      requestDate: at(0),
      expected: false,
    },
    {
      name: 'falls back without a request date',
      purchaseDate: at(-20 * day),
      requestDate: undefined,
      expected: false,
    },
    {
      name: 'falls back on an unparsable date',
      purchaseDate: 'not-a-date',
      requestDate: at(0),
      expected: false,
    },
  ])('$name', ({ purchaseDate, requestDate, expected }) => {
    expect(
      isAppleExistingSubscriptionPurchaseResult({
        purchaseResult: {
          customerInfo: {
            managementURL: null,
            requestDate,
            entitlements: { active: {} },
          },
          transaction: purchaseDate ? { purchaseDate } : undefined,
        },
        purchaseStartedAtMs: startedAtMs,
      }),
    ).toBe(expected);
  });
});
