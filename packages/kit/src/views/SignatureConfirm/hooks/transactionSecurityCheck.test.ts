import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import {
  getTransactionSecurityEncodedTxs,
  resolvePrimeUserForSecurityCheck,
  resolveTransactionSecurityCheckState,
  shouldRunTransactionSecurityCheck,
} from './transactionSecurityCheck';

const encodedTxs = getTransactionSecurityEncodedTxs([
  {
    encodedTx: {
      to: '0x1',
      data: '0x',
      value: '0x0',
      gas: '0x5208',
    } as IEncodedTx,
  },
  { accountId: 'other' },
]);

describe('getTransactionSecurityEncodedTxs', () => {
  it('keeps only transactions that have an encoded payload', () => {
    expect(encodedTxs).toHaveLength(1);
    expect(getTransactionSecurityEncodedTxs()).toEqual([]);
  });

  it('reuses the previous array when only gas identity changes', () => {
    const first = getTransactionSecurityEncodedTxs([
      {
        encodedTx: {
          to: '0x1',
          data: '0x',
          value: '0x0',
          gas: '0x5208',
        } as IEncodedTx,
      },
    ]);
    const second = getTransactionSecurityEncodedTxs(
      [
        {
          encodedTx: {
            to: '0x1',
            data: '0x',
            value: '0x0',
            gas: '0x61a8',
          } as IEncodedTx,
        },
      ],
      first,
    );

    expect(second).toBe(first);
  });

  it('does not reuse a string payload when the hex itself changes', () => {
    const first = getTransactionSecurityEncodedTxs([
      { encodedTx: '0xaaa' as IEncodedTx },
    ]);
    const second = getTransactionSecurityEncodedTxs(
      [{ encodedTx: '0xbbb' as IEncodedTx }],
      first,
    );

    expect(second).not.toBe(first);
    expect(second[0]?.encodedTx).toBe('0xbbb');
  });
});

describe('resolvePrimeUserForSecurityCheck', () => {
  it('stays unknown until persist membership is ready', () => {
    expect(
      resolvePrimeUserForSecurityCheck({
        isPrimeSubscriptionActive: false,
        isPersistReady: false,
      }),
    ).toBeUndefined();
    expect(
      resolvePrimeUserForSecurityCheck({
        isPrimeSubscriptionActive: true,
        isPersistReady: false,
      }),
    ).toBeUndefined();
  });

  it('treats a logged-in user without a Prime subscription as free', () => {
    expect(
      resolvePrimeUserForSecurityCheck({
        isPersistReady: true,
      }),
    ).toBe(false);
    expect(
      resolvePrimeUserForSecurityCheck({
        isPrimeSubscriptionActive: undefined,
        isPersistReady: true,
      }),
    ).toBe(false);
    expect(
      resolvePrimeUserForSecurityCheck({
        isPrimeSubscriptionActive: false,
        isPersistReady: true,
      }),
    ).toBe(false);
  });

  it('treats an active Prime subscription as a Prime user', () => {
    expect(
      resolvePrimeUserForSecurityCheck({
        isPrimeSubscriptionActive: true,
        isPersistReady: true,
      }),
    ).toBe(true);
  });
});

describe('shouldRunTransactionSecurityCheck', () => {
  const ready = {
    isPrimeSubscriptionActive: true,
    origin: 'https://app.example.com',
    accountId: 'account-id',
    networkId: 'evm--1',
    encodedTxs,
  };

  it('runs only when Prime, origin, and a payload are all present', () => {
    expect(shouldRunTransactionSecurityCheck(ready)).toBe(true);
    expect(
      shouldRunTransactionSecurityCheck({
        ...ready,
        isPrimeSubscriptionActive: false,
      }),
    ).toBe(false);
    expect(
      shouldRunTransactionSecurityCheck({
        ...ready,
        origin: undefined,
      }),
    ).toBe(false);
    expect(
      shouldRunTransactionSecurityCheck({
        ...ready,
        encodedTxs: [],
        jsonRpc: undefined,
      }),
    ).toBe(false);
    expect(
      shouldRunTransactionSecurityCheck({
        ...ready,
        encodedTxs: [],
        jsonRpc: {
          method: 'solana_signTransaction',
          params: ['payload'],
        },
      }),
    ).toBe(false);
    expect(
      shouldRunTransactionSecurityCheck({
        ...ready,
        encodedTxs: [],
        jsonRpc: {
          method: 'personal_sign',
          params: ['0x1'],
        },
      }),
    ).toBe(true);
    expect(
      shouldRunTransactionSecurityCheck({
        ...ready,
        encodedTxs: [
          {
            encodedTx: {
              visible: true,
              raw_data: { contract: [] },
            } as IEncodedTx,
          },
        ],
      }),
    ).toBe(false);
  });
});

describe('resolveTransactionSecurityCheckState', () => {
  const result = {
    level: EHostSecurityLevel.Security,
    detail: {
      code: 'no_issues_detected',
      features: [],
    },
  };

  it('stays pending while eligibility is unresolved for a scannable request', () => {
    expect(
      resolveTransactionSecurityCheckState({
        shouldCheck: false,
        isEligibilityPending: true,
        requestKey: 'current',
      }),
    ).toEqual({ result: undefined, isPending: true });
  });

  it('keeps pending until the current request resolves', () => {
    expect(
      resolveTransactionSecurityCheckState({
        shouldCheck: true,
        requestKey: 'current',
        isLoading: true,
      }),
    ).toEqual({
      result: undefined,
      isPending: true,
    });
    expect(
      resolveTransactionSecurityCheckState({
        shouldCheck: true,
        requestKey: 'current',
        resolvedRequestKey: 'stale',
        result,
        isLoading: false,
      }),
    ).toEqual({
      result: undefined,
      isPending: true,
    });
  });

  it('surfaces the current result once loading finishes', () => {
    expect(
      resolveTransactionSecurityCheckState({
        shouldCheck: true,
        requestKey: 'current',
        resolvedRequestKey: 'current',
        result,
        isLoading: false,
      }),
    ).toEqual({
      result,
      isPending: false,
    });
  });

  it('does not stay pending when the check is not applicable', () => {
    expect(
      resolveTransactionSecurityCheckState({
        shouldCheck: false,
        requestKey: 'current',
        result,
        isLoading: true,
      }),
    ).toEqual({
      result: undefined,
      isPending: false,
    });
  });
});
