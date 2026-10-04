import type { IWcPayAction } from '@onekeyhq/shared/src/walletConnect/payTypes';

import { getWcPayActionFingerprint } from './payFingerprintUtils';

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/payFingerprintUtils.test.ts

function buildAction({
  chainId = 'eip155:8453',
  method = 'eth_sendTransaction',
  params,
}: {
  chainId?: string;
  method?: string;
  params: string;
}): IWcPayAction {
  return { walletRpc: { chainId, method, params } };
}

describe('getWcPayActionFingerprint', () => {
  it('matches when params differ only in key order and whitespace', () => {
    // stored progress must survive a server re-fetch that returns the same
    // action with reordered/reformatted JSON params — a mismatch here would
    // drop recorded txids and re-broadcast an already sent transaction
    const stored = buildAction({
      params: '[{"to":"0x1","value":"0x0","data":"0xdead"}]',
    });
    const refreshed = buildAction({
      params: '[ {"data":"0xdead",  "value":"0x0", "to":"0x1"} ]',
    });
    expect(getWcPayActionFingerprint(stored)).not.toBeNull();
    expect(getWcPayActionFingerprint(refreshed)).toBe(
      getWcPayActionFingerprint(stored),
    );
  });

  it('matches when nested object keys are reordered', () => {
    const stored = buildAction({
      method: 'eth_signTypedData_v4',
      params: JSON.stringify([
        '0xabc',
        { domain: { chainId: 8453, name: 'Permit2' }, message: { nonce: '0' } },
      ]),
    });
    const refreshed = buildAction({
      method: 'eth_signTypedData_v4',
      params: JSON.stringify([
        '0xabc',
        { message: { nonce: '0' }, domain: { name: 'Permit2', chainId: 8453 } },
      ]),
    });
    expect(getWcPayActionFingerprint(refreshed)).toBe(
      getWcPayActionFingerprint(stored),
    );
  });

  it('differs when param values differ', () => {
    const a = buildAction({ params: '[{"to":"0x1","value":"0x0"}]' });
    const b = buildAction({ params: '[{"to":"0x1","value":"0x1"}]' });
    expect(getWcPayActionFingerprint(a)).not.toBe(getWcPayActionFingerprint(b));
  });

  it('differs when chainId or method differ', () => {
    const params = '[{"to":"0x1"}]';
    const base = buildAction({ params });
    const otherChain = buildAction({ chainId: 'eip155:1', params });
    const otherMethod = buildAction({ method: 'personal_sign', params });
    expect(getWcPayActionFingerprint(otherChain)).not.toBe(
      getWcPayActionFingerprint(base),
    );
    expect(getWcPayActionFingerprint(otherMethod)).not.toBe(
      getWcPayActionFingerprint(base),
    );
  });

  it('returns null for unparseable params', () => {
    expect(
      getWcPayActionFingerprint(buildAction({ params: '{not-json' })),
    ).toBeNull();
    expect(getWcPayActionFingerprint(buildAction({ params: '' }))).toBeNull();
  });
});
