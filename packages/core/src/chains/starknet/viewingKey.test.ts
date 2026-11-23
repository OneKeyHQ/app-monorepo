import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { ec } from 'starknet';

import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { encryptImportedCredential } from '../../secret';

import CoreChainHd from './CoreChainHd';
import CoreChainImported from './CoreChainImported';
import {
  STRK20_DERIVATION_CONTEXT_LENGTH,
  STRK20_VIEWING_KEY_PROFILE_ID,
  deriveStrk20ViewingKey,
  getStrk20PublicViewingKey,
  serializeDerivationContext,
} from './sdkStarknet/viewingKey';

import type { ICoreApiNetworkInfo } from '../../types';

/*
yarn jest packages/core/src/chains/starknet/viewingKey.test.ts

Vectors are the SNIP `account-leaf-v1` draft's own test cases.
*/

// The spec pins the domain separator by hex, so decode that rather than
// re-deriving it from the ASCII string the implementation uses.
const DOMAIN_SEPARATOR_HEX = '5354524b32305f4143434f554e545f4c4541465f5631';

const CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA
const ACCOUNT_ADDRESS = '0x1234';
const POOL_ADDRESS = '0x5678';

const CONTEXT_HEX = [
  '00000001',
  '00000000000000000000000000000000000000000000534e5f5345504f4c4941',
  '0000000000000000000000000000000000000000000000000000000000001234',
  '0000000000000000000000000000000000000000000000000000000000005678',
  '00000000000000000000000000000000',
].join('');

const STARK_CURVE_ORDER = ec.starkCurve.CURVE.n;
const STARK_LOWER_HALF_BOUND = STARK_CURVE_ORDER / BigInt(2);
const REJECTION_LIMIT = (() => {
  const two256 = BigInt(1) << BigInt(256);
  return two256 - (two256 % STARK_CURVE_ORDER);
})();

const baseContext = {
  chainId: CHAIN_ID,
  accountAddress: ACCOUNT_ADDRESS,
  poolAddress: POOL_ADDRESS,
};

/** Recomputes the profile's HMAC for one counter, straight from the spec bytes. */
function hmacAtCounter(params: {
  accountLeafPrivateKey: string;
  counter: number;
}): string {
  const key = bufferUtils.hexToBytes(
    params.accountLeafPrivateKey.replace(/^0x/, '').padStart(64, '0'),
  );
  const counterHex = params.counter.toString(16).padStart(8, '0');
  const data = bufferUtils.hexToBytes(
    `${DOMAIN_SEPARATOR_HEX}${CONTEXT_HEX}${counterHex}`,
  );
  return `0x${bufferUtils.bytesToHex(hmac(sha256, key, data))}`;
}

describe('Starknet STRK20 viewing key derivation (account-leaf-v1)', () => {
  it('exposes the profile identifier fixed by the SNIP', () => {
    expect(STRK20_VIEWING_KEY_PROFILE_ID).toBe('account-leaf-v1');
  });

  it('serializes the derivation context as 116 fixed-width bytes', () => {
    expect(STRK20_DERIVATION_CONTEXT_LENGTH).toBe(116);
    const context = serializeDerivationContext(baseContext);
    expect(context.length).toBe(STRK20_DERIVATION_CONTEXT_LENGTH);
    expect(bufferUtils.bytesToHex(context)).toBe(CONTEXT_HEX);
    // an omitted key_index must serialize exactly like an explicit 0
    expect(
      bufferUtils.bytesToHex(
        serializeDerivationContext({ ...baseContext, keyIndex: 0 }),
      ),
    ).toBe(CONTEXT_HEX);
  });

  it('matches the SNIP primary vector (account leaf key 1, counter 0)', () => {
    expect(hmacAtCounter({ accountLeafPrivateKey: '0x1', counter: 0 })).toBe(
      '0x3ed14752a332877b8097f5bc9b24c89689a29a5d10266060345df8685c8efdad',
    );

    const result = deriveStrk20ViewingKey({
      ...baseContext,
      accountLeafPrivateKey: '0x1',
    });
    expect(result.counter).toBe(0);
    expect(result.viewingKey).toBe(
      '0x012eb8ad5ccd790c7f680a4364db37673265f91147173130bed719a511a36bcb',
    );
    expect(result.publicKeyX).toBe(
      '0x0435ada564d3bb1c5ac7caac8aa5fdc7dfa5de1aea83ff660099ea619a08c7a5',
    );
  });

  it('matches the SNIP rejection-sampling vector (account leaf key 5, counter 1)', () => {
    const counter0Hmac = hmacAtCounter({
      accountLeafPrivateKey: '0x5',
      counter: 0,
    });
    expect(counter0Hmac).toBe(
      '0xfd90c57fe6b814ea57268d16153d1c86312344f3e5e77ec22630ad48e6e9b96c',
    );
    // counter 0 is rejected before reduction because it sits at or above limit
    expect(BigInt(counter0Hmac) >= REJECTION_LIMIT).toBe(true);

    expect(hmacAtCounter({ accountLeafPrivateKey: '0x5', counter: 1 })).toBe(
      '0xae52983668004e406e69bfc4a7acfa9765c032128ee6705566e0eb44bde2061a',
    );

    const result = deriveStrk20ViewingKey({
      ...baseContext,
      accountLeafPrivateKey: '0x5',
    });
    expect(result.counter).toBe(1);
    expect(result.viewingKey).toBe(
      '0x01ad67c997ffb3359196403b585305625f57635ce102dff935f1066031289bf0',
    );
    expect(result.publicKeyX).toBe(
      '0x04366caa68f40c9467a805b2646bcca3ac60c320c165564f69bc2de4b668e7ed',
    );
  });

  it('returns a canonical lower-half scalar', () => {
    for (const accountLeafPrivateKey of ['0x1', '0x5']) {
      const { viewingKey } = deriveStrk20ViewingKey({
        ...baseContext,
        accountLeafPrivateKey,
      });
      const scalar = BigInt(viewingKey);
      expect(scalar >= BigInt(1)).toBe(true);
      expect(scalar < STARK_LOWER_HALF_BOUND).toBe(true);
    }
  });

  it('is deterministic across calls', () => {
    const first = deriveStrk20ViewingKey({
      ...baseContext,
      accountLeafPrivateKey: '0x1',
    });
    const second = deriveStrk20ViewingKey({
      ...baseContext,
      accountLeafPrivateKey: '0x1',
    });
    expect(second).toEqual(first);
    // zero-padded and short leaf hex are the same scalar
    expect(
      deriveStrk20ViewingKey({
        ...baseContext,
        accountLeafPrivateKey: `0x${'1'.padStart(64, '0')}`,
      }),
    ).toEqual(first);
  });

  it('binds the key to chain, account, pool and key index', () => {
    const base = deriveStrk20ViewingKey({
      ...baseContext,
      accountLeafPrivateKey: '0x1',
    });
    const variants = [
      { ...baseContext, chainId: '0x534e5f4d41494e' },
      { ...baseContext, accountAddress: '0x1235' },
      { ...baseContext, poolAddress: '0x5679' },
      { ...baseContext, keyIndex: 1 },
    ];
    for (const variant of variants) {
      const derived = deriveStrk20ViewingKey({
        ...variant,
        accountLeafPrivateKey: '0x1',
      });
      expect(derived.viewingKey).not.toBe(base.viewingKey);
    }
    // key_index defaults to 0, so omitting it must not silently drift
    expect(
      deriveStrk20ViewingKey({
        ...baseContext,
        keyIndex: 0,
        accountLeafPrivateKey: '0x1',
      }).viewingKey,
    ).toBe(base.viewingKey);
  });

  it('rejects an account leaf scalar outside the signing curve range', () => {
    const outOfRange = [
      '0x0',
      `0x${STARK_CURVE_ORDER.toString(16).padStart(64, '0')}`,
      `0x${(STARK_CURVE_ORDER + BigInt(1)).toString(16).padStart(64, '0')}`,
    ];
    for (const accountLeafPrivateKey of outOfRange) {
      expect(() =>
        deriveStrk20ViewingKey({ ...baseContext, accountLeafPrivateKey }),
      ).toThrow();
    }
  });

  it('rejects malformed or non-fixed-width context values', () => {
    const malformed = [
      // not hex at all
      { ...baseContext, chainId: 'SN_SEPOLIA' },
      // decimal 0x1234 with no prefix; also valid hex, so it must be rejected
      // rather than silently reinterpreted
      { ...baseContext, accountAddress: '4660' },
      // wider than 32 bytes, so I2OSP(_, 32) cannot hold it
      { ...baseContext, poolAddress: `0x${'f'.repeat(66)}` },
      // above the Starknet field prime, so not a felt252
      { ...baseContext, chainId: `0x${'f'.repeat(64)}` },
      // key_index must be a non-negative integer
      { ...baseContext, keyIndex: -1 },
      { ...baseContext, keyIndex: 1.5 },
    ];
    for (const params of malformed) {
      expect(() => serializeDerivationContext(params)).toThrow();
      expect(() =>
        deriveStrk20ViewingKey({ ...params, accountLeafPrivateKey: '0x1' }),
      ).toThrow();
    }
  });

  it('getStrk20PublicViewingKey agrees with derivation and rejects non-canonical scalars', () => {
    const { viewingKey, publicKeyX } = deriveStrk20ViewingKey({
      ...baseContext,
      accountLeafPrivateKey: '0x1',
    });
    expect(getStrk20PublicViewingKey(viewingKey)).toBe(publicKeyX);
    // unpadded input is the same scalar
    expect(
      getStrk20PublicViewingKey(`0x${BigInt(viewingKey).toString(16)}`),
    ).toBe(publicKeyX);

    const nonCanonical = [
      '0x0',
      `0x${STARK_LOWER_HALF_BOUND.toString(16).padStart(64, '0')}`,
      `0x${(STARK_CURVE_ORDER - BigInt(1)).toString(16).padStart(64, '0')}`,
      'not-hex',
    ];
    for (const value of nonCanonical) {
      expect(() => getStrk20PublicViewingKey(value)).toThrow();
    }
  });
});

describe('CoreChainSoftware.deriveStrk20ViewingKey', () => {
  const { hdCredential1 } = coreTestsFixtures;

  const networkInfo: ICoreApiNetworkInfo = {
    networkChainCode: 'starknet',
    chainId: CHAIN_ID,
    networkId: 'starknet--sepolia',
    networkImpl: 'starknet',
    isTestnet: true,
  };

  // m/44'/9004'/0'/0/0 of the shared test mnemonic with its OpenZeppelin v0.17.0
  // address; the derivation binds whatever address it is given
  const account = {
    address:
      '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec',
    path: "m/44'/9004'/0'/0/0",
    starkPrivateKey:
      '0x0188ec73b904cda31f0a1152ee14542d0ab7ac1ae3ec7a9a3c4f38bd0b3579d6',
  };

  const expected = {
    viewingKey:
      '0x0195e031668fd442f9057e4f5b22c9297e98046dfc06b2efb9083f2fd79239af',
    publicKeyX:
      '0x0775de99ba0b481868ff5513344a5f97729558afb6783033ec8fea502ec19d15',
    counter: 0,
  };

  it('derives from an HD credential using the ground account signer key', async () => {
    const coreApi = new CoreChainHd();
    const result = await coreApi.deriveStrk20ViewingKey({
      networkInfo,
      password: hdCredential1.password,
      credentials: { hd: hdCredential1.hdCredentialHex },
      addressEncoding: EAddressEncodings.STARKNET_OZ,
      account: { address: account.address, path: account.path },
      chainId: CHAIN_ID,
      accountAddress: account.address,
      poolAddress: POOL_ADDRESS,
    });
    expect(result).toEqual(expected);
    // identical to the pure function fed the exported Stark private key
    expect(
      deriveStrk20ViewingKey({
        accountLeafPrivateKey: account.starkPrivateKey,
        chainId: CHAIN_ID,
        accountAddress: account.address,
        poolAddress: POOL_ADDRESS,
      }),
    ).toEqual(expected);
  });

  it('derives an Argent HD account from its own Argent X Stark key', async () => {
    // Argent derive type of the same mnemonic and path; values from the
    // Argent X replica recorded in CoreChainSoftware.test.ts
    const argentAccount = {
      address:
        '0x0341ddbc8c03c39c40bf3062e4c39670957d9945b5140f045114d7425490fb10',
      path: "m/44'/9004'/0'/0/0",
      starkPrivateKey:
        '0x026bc60675deb071acb5c04aba2db0621f8b83cf0dd8600d609e303bb7390e04',
    };
    const coreApi = new CoreChainHd();
    const result = await coreApi.deriveStrk20ViewingKey({
      networkInfo,
      password: hdCredential1.password,
      credentials: { hd: hdCredential1.hdCredentialHex },
      account: { address: argentAccount.address, path: argentAccount.path },
      chainId: CHAIN_ID,
      accountAddress: argentAccount.address,
      poolAddress: POOL_ADDRESS,
    });
    expect(result).toEqual(
      deriveStrk20ViewingKey({
        accountLeafPrivateKey: argentAccount.starkPrivateKey,
        chainId: CHAIN_ID,
        accountAddress: argentAccount.address,
        poolAddress: POOL_ADDRESS,
      }),
    );
    expect(result.viewingKey).not.toBe(expected.viewingKey);
  });

  it('derives the same key from the equivalent imported credential', async () => {
    const coreApi = new CoreChainImported();
    const result = await coreApi.deriveStrk20ViewingKey({
      networkInfo,
      password: hdCredential1.password,
      credentials: {
        imported: await encryptImportedCredential({
          password: hdCredential1.password,
          credential: { privateKey: account.starkPrivateKey },
        }),
      },
      account: { address: account.address, path: account.path },
      chainId: CHAIN_ID,
      accountAddress: account.address,
      poolAddress: POOL_ADDRESS,
    });
    expect(result).toEqual(expected);
  });
});
