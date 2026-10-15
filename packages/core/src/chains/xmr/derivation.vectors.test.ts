import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';

import { encryptRevealableSeed, mnemonicToRevealableSeed } from '../../secret';

import CoreChainHd from './CoreChainHd';
import { getXmrCurveForPath } from './CoreChainSoftware';
import { setXmrRuntimeLoader } from './sdkXmrRuntime/address';

import type { IXmrPureRuntimeApi } from './sdkXmrRuntime/address';

/**
 * Published vectors from the two wallets whose BIP-39 derivation we follow.
 * They pin what this package owns -- derive type -> path -> curve -> the
 * 32-byte BIP-32 key -- by checking the spend key reduced from it. The runtime
 * owns key -> address and is tested against its own vectors.
 *
 * Templates mirror kit-bg xmr settings (`default` = Trezor, `cake` = Cake).
 */
const CAKE_TEMPLATE = `m/44'/128'/${INDEX_PLACEHOLDER}'/0/0`;
const TREZOR_TEMPLATE = `m/44'/128'/${INDEX_PLACEHOLDER}'`;

// ed25519 group order.
const L = 2n ** 252n + 27_742_317_777_372_353_535_851_937_790_883_648_493n;

function reduceLe(bytes: Uint8Array): Uint8Array {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1)
    n = n * 256n + BigInt(bytes[i]);
  n %= L;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number(n % 256n);
    n /= 256n;
  }
  return out;
}

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

// Records the BIP-32 key the core hands the runtime; the address is a stub.
const received: string[] = [];
const fakeRuntime = {
  async deriveAccount(_network: string, keyHex: string) {
    received.push(keyHex);
    return JSON.stringify({
      primaryAddress: 'stub',
      spendPublicKeyHex: '11'.repeat(32),
      viewPrivateKeyHex: '22'.repeat(32),
    });
  },
} as unknown as IXmrPureRuntimeApi;

async function spendKeysFor(mnemonic: string, template: string, count = 1) {
  const password = 'vector-test';
  const hdCredential = await encryptRevealableSeed({
    rs: mnemonicToRevealableSeed(mnemonic),
    password,
  });
  received.length = 0;
  await new CoreChainHd().getAddressesFromHd({
    networkInfo: {
      networkChainCode: 'xmr',
      chainId: '0',
      networkId: 'xmr--0',
      networkImpl: 'xmr',
    },
    template,
    hdCredential,
    password,
    indexes: Array.from({ length: count }, (_, i) => i),
    addressEncoding: undefined,
  });
  return received.map((keyHex) => toHex(reduceLe(Buffer.from(keyHex, 'hex'))));
}

beforeAll(() => {
  setXmrRuntimeLoader(async () => fakeRuntime);
});

describe('xmr derive type -> curve', () => {
  it('uses secp256k1 for the Cake path and ed25519 for the Trezor path', () => {
    expect(getXmrCurveForPath(CAKE_TEMPLATE)).toBe('secp256k1');
    expect(getXmrCurveForPath("m/44'/128'/3'/0/0")).toBe('secp256k1');
    expect(getXmrCurveForPath(TREZOR_TEMPLATE)).toBe('ed25519');
    expect(getXmrCurveForPath("m/44'/128'/3'")).toBe('ed25519');
  });
});

describe('xmr published derivation vectors', () => {
  // cake-tech/cake_wallet@80a8c83 cw_monero/test/bip39_seed_test.dart. Cake
  // publishes legacy 25-word seeds, which encode the spend key; the hex below
  // is those seeds decoded (MyMonero core), accounts 0 and 1.
  it.each([
    [
      'meadow tip best belt boss eyebrow control affair eternal piece very shiver',
      [
        '96c80ac86d8b8374af5ea0376334d536a81c31ce3cd14874aa76fc0a9ddec60b',
        '1138b972b514bf8f77c1f44f4df2f0aa9afc0cb884d958c89b2f7f6e41e22e04',
      ],
    ],
    [
      'color ranch color remove subway public water embrace before begin liberty fault',
      [
        '3b5a4aa502bb91e3a5b78133d445339b809034074eede04abdc67a4425ed350c',
        'fb21311ac66a0abf394adff8144cd071b883554e67671c73ab2367480833310d',
      ],
    ],
  ])('matches Cake Wallet for %s', async (mnemonic, expected) => {
    expect(await spendKeysFor(mnemonic, CAKE_TEMPLATE, 2)).toEqual(expected);
  });

  // cspell:ignore getwatchkey
  // trezor/trezor-firmware@148e530 tests/device_tests/monero/
  // test_getwatchkey.py, m/44h/128h/0h. Trezor publishes the view key, which
  // is keccak256(spend) mod l.
  it('matches Trezor', async () => {
    const [spend] = await spendKeysFor(
      'alcohol woman abuse must during monitor noble actual mixed trade anger aisle',
      TREZOR_TEMPLATE,
    );
    const view = toHex(reduceLe(keccak256(Buffer.from(spend, 'hex'))));
    expect(view).toBe(
      '8722520a581e2a50cc1adab4a1692401effd37b0d63b9d9b60fd7f34ea2b950e',
    );
  });
});
