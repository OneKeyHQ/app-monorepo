import {
  deriveXmrAccount,
  setXmrRuntimeLoader,
  validateXmrAddress,
} from './sdkXmrRuntime/address';

import type { IXmrPureRuntimeApi } from './sdkXmrRuntime/address';
import type { IXmrNetwork } from './sdkXmrRuntime/types';

/**
 * These tests pin the **wiring**, not the cryptography.
 *
 * The reduction itself (`spend = sc_reduce32(key)`, `view = keccak256(spend)`)
 * lives in the Rust runtime and is tested there against its own vectors. What
 * can go wrong on this side is plumbing: the wrong network reaching the
 * runtime, the halves of the viewing pair being swapped, or a JSON shape
 * drifting — and all three are silent failures that produce a plausible
 * address for the wrong wallet.
 */

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
  /**
   * With no carrier registered, derivation falls back to loading the wasm
   * module in-process — address derivation is microseconds of pure
   * computation and should not require the Worker that scanning does.
   *
   * That fallback only reaches a working module in a browser-like environment:
   * the shipped package is a wasm-pack `web` build, whose initializer fetches
   * its `.wasm` by relative URL. Under jest (plain Node, no document base URL)
   * that fetch cannot resolve.
   *
   * What this test pins is the part that matters either way: **the failure
   * surfaces**. A silent fallback would let an account record be written with
   * an empty address, and an empty address is a receive form that quietly
   * loses money.
   */
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

  /**
   * The spend key is public material here and the view key is private. Swap
   * them and scanning quietly finds nothing while the address still looks
   * correct — the worst shape of bug, because everything renders fine.
   */
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
    // A mainnet address on testnet is not "wrong network" -- it is a
    // well-formed destination nobody holds the keys to.
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
