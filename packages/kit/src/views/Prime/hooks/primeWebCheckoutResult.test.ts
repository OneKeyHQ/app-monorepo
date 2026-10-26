import {
  PRIME_WEB_CHECKOUT_PURCHASE_DATE_TOLERANCE_MS,
  evaluatePrimeWebCheckoutResult,
} from './primeWebCheckoutResult';

import type { IPrimeWebCheckoutEntitlement } from './primeWebCheckoutResult';

/*
yarn test packages/kit/src/views/Prime/hooks/primeWebCheckoutResult.test.ts
*/

const startedAt = Date.UTC(2026, 9, 16, 8, 0, 0);
const session = { isSandbox: true, startedAt };

function buildEntitlement(
  overrides: Partial<IPrimeWebCheckoutEntitlement> = {},
): IPrimeWebCheckoutEntitlement {
  return {
    isActive: true,
    store: 'rc_billing',
    latestPurchaseDate: new Date(startedAt + 60_000),
    isSandbox: true,
    periodType: 'normal',
    productIdentifier: 'prime_yearly',
    ...overrides,
  };
}

describe('evaluatePrimeWebCheckoutResult', () => {
  it('stays pending while Prime is inactive', () => {
    expect(
      evaluatePrimeWebCheckoutResult({ session, entitlement: undefined }),
    ).toEqual({ status: 'pending' });
    expect(
      evaluatePrimeWebCheckoutResult({
        session,
        entitlement: buildEntitlement({ isActive: false }),
      }),
    ).toEqual({ status: 'pending' });
  });

  it('succeeds for a Web Billing purchase made by this checkout', () => {
    const entitlement = buildEntitlement({
      latestPurchaseDate: new Date(
        startedAt - PRIME_WEB_CHECKOUT_PURCHASE_DATE_TOLERANCE_MS,
      ),
    });
    expect(evaluatePrimeWebCheckoutResult({ session, entitlement })).toEqual({
      status: 'succeeded',
      entitlement,
    });
  });

  it.each([
    ['another store', { store: 'app_store' }],
    ['the other sandbox mode', { isSandbox: false }],
    [
      'an older purchase',
      {
        latestPurchaseDate: new Date(
          startedAt - PRIME_WEB_CHECKOUT_PURCHASE_DATE_TOLERANCE_MS - 1,
        ),
      },
    ],
    ['an unknown purchase date', { latestPurchaseDate: null }],
  ])('reports activation elsewhere for %s', (_label, overrides) => {
    expect(
      evaluatePrimeWebCheckoutResult({
        session,
        entitlement: buildEntitlement(overrides),
      }).status,
    ).toBe('activatedElsewhere');
  });
});
