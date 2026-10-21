import {
  deriveXmrAccount,
  setXmrRuntimeLoader,
  validateXmrAddress,
} from './sdkXmrRuntime/address';

import type { IXmrPureRuntimeApi } from './sdkXmrRuntime/address';
import type { IXmrNetwork } from './sdkXmrRuntime/types';

// Pins the wiring, not the cryptography (the runtime tests its own vectors):
// a wrong network, swapped viewing-pair halves or a drifted JSON shape all
// silently produce a plausible address for the wrong wallet.

function fakeRuntime(): IXmrPureRuntimeApi & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    async deriveAccount(network: IXmrNetwork, key: string) {
      calls.push({ method: 'deriveAccount', args: [network, key] });
      return JSON.stringify({
        primaryAddress: `addr-${network}-${key.slice(0, 4)}`,
        spendPublicKeyHex: `spend-${key.slice(0, 4)}`,
        viewPrivateKeyHex: `view-${key.slice(0, 4)}`,
      });
    },
    async deriveSubaddress(
      network: IXmrNetwork,
      spend: string,
      view: string,
      major: number,
      minor: number,
    ) {
      calls.push({
        method: 'deriveSubaddress',
        args: [network, spend, view, major, minor],
      });
      return JSON.stringify({
        address: `sub-${major}-${minor}`,
        major,
        minor,
      });
    },
    async validateAddress(network: IXmrNetwork, address: string) {
      calls.push({ method: 'validateAddress', args: [network, address] });
      return address.startsWith(network === 'mainnet' ? '4' : '9');
    },
    async verifyTransaction() {
      calls.push({ method: 'verifyTransaction', args: [] });
    },
    async signTransactionWithBip32Key(
      signableHex: string,
      bip32PrivateKeyHex: string,
    ) {
      calls.push({
        method: 'signTransactionWithBip32Key',
        args: [signableHex, bip32PrivateKeyHex],
      });
      return JSON.stringify({
        txid: `txid-${signableHex.slice(0, 4)}`,
        rawHex: `raw-${signableHex}`,
        sizeBytes: signableHex.length / 2,
      });
    },
  };
}

describe('xmr derivation plumbing', () => {
  // The in-process fallback cannot load the wasm under jest; the failure must
  // surface, since an empty address would be a receive form that loses money.
  it('surfaces a failure rather than deriving nothing when no carrier is registered', async () => {
    setXmrRuntimeLoader(undefined as never);
    await expect(
      deriveXmrAccount({ network: 'mainnet', bip32PrivateKeyHex: 'aa' }),
    ).rejects.toThrow();
  });

  it('passes the network through instead of assuming mainnet', async () => {
    const runtime = fakeRuntime();
    setXmrRuntimeLoader(async () => runtime);

    await deriveXmrAccount({
      network: 'testnet',
      bip32PrivateKeyHex: 'deadbeef',
    });

    expect(runtime.calls[0]).toEqual({
      method: 'deriveAccount',
      args: ['testnet', 'deadbeef'],
    });
  });

  // Swapped halves scan nothing while the address still looks correct.
  it('keeps the viewing pair halves in their own fields', async () => {
    const runtime = fakeRuntime();
    setXmrRuntimeLoader(async () => runtime);

    const derived = await deriveXmrAccount({
      network: 'mainnet',
      bip32PrivateKeyHex: 'cafebabe',
    });

    expect(derived.spendPublicKeyHex).toBe('spend-cafe');
    expect(derived.viewPrivateKeyHex).toBe('view-cafe');
    expect(derived.primaryAddress).toBe('addr-mainnet-cafe');
  });

  it('validates addresses against the requested network', async () => {
    const runtime = fakeRuntime();
    setXmrRuntimeLoader(async () => runtime);

    await expect(
      validateXmrAddress({ address: '4abc', network: 'mainnet' }),
    ).resolves.toBe(true);
    await expect(
      validateXmrAddress({ address: '4abc', network: 'testnet' }),
    ).resolves.toBe(false);
  });

  it('defaults address validation to mainnet only when asked to', async () => {
    const runtime = fakeRuntime();
    setXmrRuntimeLoader(async () => runtime);

    await validateXmrAddress({ address: '4abc' });
    expect(runtime.calls.at(-1)).toEqual({
      method: 'validateAddress',
      args: ['mainnet', '4abc'],
    });
  });
});
