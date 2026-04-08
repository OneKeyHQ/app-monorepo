/* eslint-disable import/first */
// Mock the deep dependency that pulls in react-native
jest.mock('@onekeyhq/core/src/secret', () => ({
  revealableSeedFromMnemonic: jest.fn(),
}));

jest.mock(
  '../../packages/core/src/chains/evm',
  () => {
    // noop — the EvmSigner lazy-loads this, we don't exercise it here
  },
  { virtual: true },
);

import { getSignerByImpl } from '../signer/factory';
import { EvmSigner } from '../signer/impls/evm/EvmSigner';

describe('signer factory', () => {
  it('returns EvmSigner for evm impl', async () => {
    const signer = await getSignerByImpl('evm');
    expect(signer).toBeInstanceOf(EvmSigner);
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
