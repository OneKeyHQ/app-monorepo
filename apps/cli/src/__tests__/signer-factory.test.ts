/* eslint-disable import/first */
// Mock the deep dependency that pulls in react-native
jest.mock('@onekeyhq/core/src/secret', () => ({
  revealableSeedFromMnemonic: jest.fn(),
}));

jest.mock(
  '../../packages/core/src/chains/evm',
  () => {
    // noop — SignerHd lazy-loads this, we don't exercise it here
  },
  { virtual: true },
);

// getSignerByImpl auto-auths via requireAuthenticatedSession; stub it so
// tests don't need a real session on disk.
jest.mock('../core/auth/auth-gate', () => ({
  requireAuthenticatedSession: jest.fn(async () => ({
    authStatus: 'authenticated',
    hasSecrets: true,
    storageBackend: 'macos-keychain',
    walletKind: 'hd',
  })),
}));

import { getSignerByImpl } from '../signer/factory';
import { SignerHd as BtcSignerHd } from '../signer/impls/btc/SignerHd';
import { SignerHd } from '../signer/impls/evm/SignerHd';

describe('signer factory', () => {
  it('returns SignerHd for evm impl', async () => {
    const signer = await getSignerByImpl('evm');
    expect(signer).toBeInstanceOf(SignerHd);
  });

  it('returns BTC SignerHd for btc impl under an HD session', async () => {
    const signer = await getSignerByImpl('btc');
    expect(signer).toBeInstanceOf(BtcSignerHd);
  });

  it('returns BTC SignerHd for tbtc impl under an HD session', async () => {
    const signer = await getSignerByImpl('tbtc');
    expect(signer).toBeInstanceOf(BtcSignerHd);
  });

  it('throws for unsupported impl', async () => {
    await expect(getSignerByImpl('unknown')).rejects.toThrow(
      'Unsupported chain',
    );
  });

  it('returns same class for repeated calls', async () => {
    const a = await getSignerByImpl('evm');
    const b = await getSignerByImpl('evm');
    expect(a.constructor).toBe(b.constructor);
  });
});
