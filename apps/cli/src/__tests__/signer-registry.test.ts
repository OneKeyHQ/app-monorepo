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

import { SignerHd } from '../signer/impls/evm/SignerHd';
import {
  requireSignerBuilder,
  resolveSignerRegistration,
} from '../signer/registry';

async function buildHdSigner(impl: string) {
  const registration = await resolveSignerRegistration(impl);
  return requireSignerBuilder(registration, 'hd')();
}

describe('signer registry', () => {
  it('returns SignerHd for evm impl', async () => {
    const signer = await buildHdSigner('evm');
    expect(signer).toBeInstanceOf(SignerHd);
  });

  it('throws for unsupported impl', async () => {
    await expect(resolveSignerRegistration('unknown')).rejects.toThrow(
      'Unsupported chain',
    );
  });

  it('returns same class for repeated calls', async () => {
    const a = await buildHdSigner('evm');
    const b = await buildHdSigner('evm');
    expect(a.constructor).toBe(b.constructor);
  });
});
