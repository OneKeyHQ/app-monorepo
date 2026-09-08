import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import {
  getTransactionSecurityEncodedTxs,
  getTransactionSecurityRequestKey,
  hasScannableTransactionSecurityRequest,
  resolveTransactionSecurityApplicability,
  resolveTransactionSecurityCheckState,
  runTransactionSecurityChecks,
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
});

describe('getTransactionSecurityRequestKey', () => {
  it('changes when the transaction payload changes but ignores fee-only changes', () => {
    const getRequestKey = (data: string, gas: string) =>
      getTransactionSecurityRequestKey({
        requestKey: 'tx-uuid',
        encodedTxs: getTransactionSecurityEncodedTxs([
          {
            encodedTx: {
              to: '0x1',
              data,
              value: '0x0',
              gas,
            } as IEncodedTx,
          },
        ]),
      });

    expect(getRequestKey('0xaaa', '0x5208')).not.toBe(
      getRequestKey('0xbbb', '0x5208'),
    );
    expect(getRequestKey('0xaaa', '0x5208')).toBe(
      getRequestKey('0xaaa', '0x61a8'),
    );
    expect(
      getTransactionSecurityRequestKey({
        requestKey: 'tx-uuid',
        origin: 'https://first.example',
        encodedTxs,
      }),
    ).not.toBe(
      getTransactionSecurityRequestKey({
        requestKey: 'tx-uuid',
        origin: 'https://second.example',
        encodedTxs,
      }),
    );
  });

  it('changes when the JSON-RPC payload changes', () => {
    const getRequestKey = (message: string) =>
      getTransactionSecurityRequestKey({
        requestKey: 'message-id',
        jsonRpc: {
          method: 'personal_sign',
          params: [message],
        },
      });

    expect(getRequestKey('0xaaa')).not.toBe(getRequestKey('0xbbb'));
  });
});

describe('runTransactionSecurityChecks', () => {
  it('keeps a sibling risk result when another check rejects', async () => {
    const result = await runTransactionSecurityChecks([
      async () => ({
        level: EHostSecurityLevel.High,
        detail: {
          code: 'known_malicious_interaction',
          features: [],
        },
      }),
      async () => Promise.reject(new Error('IPC unavailable')),
    ]);

    expect(result).toMatchObject({
      level: EHostSecurityLevel.High,
      coverage: {
        hasUncoveredRequests: false,
        hasFailedRequests: true,
      },
    });
  });
});

describe('resolveTransactionSecurityApplicability', () => {
  it('requires a current supported network for a scannable request', () => {
    expect(
      resolveTransactionSecurityApplicability({
        hasScannableRequest: false,
        networkId: 'evm--1',
      }),
    ).toBe(false);
    expect(
      resolveTransactionSecurityApplicability({
        hasScannableRequest: true,
        networkId: 'evm--1',
        resolvedNetworkId: 'evm--137',
      }),
    ).toBeUndefined();
    expect(
      resolveTransactionSecurityApplicability({
        hasScannableRequest: true,
        networkId: 'evm--1',
        resolvedNetworkId: 'evm--1',
        isCustomNetwork: true,
      }),
    ).toBe(false);
    expect(
      resolveTransactionSecurityApplicability({
        hasScannableRequest: true,
        networkId: 'evm--1',
        resolvedNetworkId: 'evm--1',
        isCustomNetwork: false,
      }),
    ).toBe(true);
  });
});

describe('hasScannableTransactionSecurityRequest', () => {
  const ready = {
    origin: 'https://app.example.com',
    accountId: 'account-id',
    networkId: 'evm--1',
    encodedTxs,
  };

  it('requires origin, account, network, and a supported payload', () => {
    expect(hasScannableTransactionSecurityRequest(ready)).toBe(true);
    expect(
      hasScannableTransactionSecurityRequest({
        ...ready,
        origin: undefined,
      }),
    ).toBe(false);
    expect(
      hasScannableTransactionSecurityRequest({
        ...ready,
        encodedTxs: [],
        jsonRpc: undefined,
      }),
    ).toBe(false);
    expect(
      hasScannableTransactionSecurityRequest({
        ...ready,
        encodedTxs: [],
        jsonRpc: {
          method: 'solana_signTransaction',
          params: ['payload'],
        },
      }),
    ).toBe(false);
    expect(
      hasScannableTransactionSecurityRequest({
        ...ready,
        encodedTxs: [],
        jsonRpc: {
          method: 'personal_sign',
          params: ['0x1'],
        },
      }),
    ).toBe(true);
    expect(
      hasScannableTransactionSecurityRequest({
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
