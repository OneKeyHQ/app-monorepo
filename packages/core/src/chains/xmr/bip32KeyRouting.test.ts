import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { encryptRevealableSeed, mnemonicToRevealableSeed } from '../../secret';

import CoreChainHd from './CoreChainHd';
import { setXmrRuntimeLoader } from './sdkXmrRuntime/address';
import { getXmrReviewRequest } from './transactionReview';

import type { IXmrPureRuntimeApi } from './sdkXmrRuntime/address';
import type { IEncodedTxXmr } from './types';
import type { ICoreApiNetworkInfo } from '../../types';

// Signing and key-image import hand the runtime the same BIP-32 key address
// derivation does; no spend key crosses back. Checked for both derive types.

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

const networkInfo: ICoreApiNetworkInfo = {
  networkChainCode: 'xmr',
  chainId: '0',
  networkId: 'xmr--0',
  networkImpl: 'xmr',
  isTestnet: false,
};

const encodedTx: IEncodedTxXmr = {
  from: 'synthetic-sender',
  to: 'synthetic-recipient',
  amount: '1',
  amountAtomic: '1000000000000',
  feeAtomic: '30000000',
  changeAtomic: '0',
  priority: 'normal',
  chainTip: 3_767_827,
  signableHex: 'aabb',
  inputCount: 1,
};

type ICall = { method: string; args: unknown[] };

const PURE_METHODS = new Set<string>([
  'deriveAccount',
  'deriveSubaddress',
  'validateAddress',
  'verifyTransaction',
  'signTransactionWithBip32Key',
]);

// Records every call; touching any other method fails the test.
function recordingRuntime(calls: ICall[]): IXmrPureRuntimeApi {
  const api: IXmrPureRuntimeApi = {
    async deriveAccount(network, bip32PrivateKeyHex) {
      calls.push({
        method: 'deriveAccount',
        args: [network, bip32PrivateKeyHex],
      });
      return JSON.stringify({
        primaryAddress: 'stub',
        spendPublicKeyHex: '11'.repeat(32),
        viewPrivateKeyHex: '22'.repeat(32),
      });
    },
    async deriveSubaddress() {
      throw new OneKeyLocalError('unexpected deriveSubaddress');
    },
    async validateAddress() {
      throw new OneKeyLocalError('unexpected validateAddress');
    },
    async verifyTransaction(signableHex, reviewJson) {
      calls.push({
        method: 'verifyTransaction',
        args: [signableHex, reviewJson],
      });
    },
    async signTransactionWithBip32Key(
      signableHex,
      bip32PrivateKeyHex,
      reviewJson,
    ) {
      calls.push({
        method: 'signTransactionWithBip32Key',
        args: [signableHex, bip32PrivateKeyHex, reviewJson],
      });
      return JSON.stringify({
        txid: '11'.repeat(32),
        rawHex: 'aabb',
        sizeBytes: 2,
      });
    },
  };
  return new Proxy(api, {
    get(target, property, receiver) {
      // `then` is probed when the loader's promise resolves to this object.
      if (
        typeof property === 'string' &&
        property !== 'then' &&
        !PURE_METHODS.has(property)
      ) {
        throw new OneKeyLocalError(
          `runtime method "${property}" must not be used`,
        );
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
}

async function credentialFor(mnemonic: string, password: string) {
  return encryptRevealableSeed({
    rs: mnemonicToRevealableSeed(mnemonic),
    password,
  });
}

describe.each([
  {
    deriveType: 'cake',
    template: `m/44'/128'/${INDEX_PLACEHOLDER}'/0/0`,
    path: "m/44'/128'/0'/0/0",
    mnemonic:
      'meadow tip best belt boss eyebrow control affair eternal piece very shiver',
    // Cake publishes the spend key.
    published: (key: Uint8Array) => toHex(reduceLe(key)),
    expected:
      '96c80ac86d8b8374af5ea0376334d536a81c31ce3cd14874aa76fc0a9ddec60b',
  },
  {
    deriveType: 'default',
    template: `m/44'/128'/${INDEX_PLACEHOLDER}'`,
    path: "m/44'/128'/0'",
    mnemonic:
      'alcohol woman abuse must during monitor noble actual mixed trade anger aisle',
    // Trezor publishes the view key, keccak256(spend) mod l.
    published: (key: Uint8Array) => toHex(reduceLe(keccak256(reduceLe(key)))),
    expected:
      '8722520a581e2a50cc1adab4a1692401effd37b0d63b9d9b60fd7f34ea2b950e',
  },
])(
  'xmr $deriveType derive type: the runtime gets the BIP-32 key',
  ({ template, path, mnemonic, published, expected }) => {
    const password = 'routing-test';
    const calls: ICall[] = [];
    let addressKey = '';

    beforeAll(async () => {
      setXmrRuntimeLoader(async () => recordingRuntime(calls));
      await new CoreChainHd().getAddressesFromHd({
        networkInfo,
        template,
        hdCredential: await credentialFor(mnemonic, password),
        password,
        indexes: [0],
        addressEncoding: undefined,
      });
      [addressKey] = calls
        .filter((call) => call.method === 'deriveAccount')
        .map((call) => call.args[1] as string);
    });

    beforeEach(() => {
      calls.length = 0;
    });

    const payload = async () => ({
      networkInfo,
      password,
      credentials: { hd: await credentialFor(mnemonic, password) },
      account: { address: encodedTx.from, path },
    });

    it('derives the address from the published key', () => {
      expect(published(Buffer.from(addressKey, 'hex'))).toBe(expected);
    });

    it('signs with that key, sent once, and nothing else', async () => {
      const signed = await new CoreChainHd().signTransaction({
        ...(await payload()),
        unsignedTx: { encodedTx },
      });
      expect(signed.txid).toBe('11'.repeat(32));

      const reviewJson = stringUtils.stableStringify(
        getXmrReviewRequest(encodedTx, 'mainnet'),
      );
      expect(calls).toEqual([
        { method: 'verifyTransaction', args: ['aabb', reviewJson] },
        {
          method: 'signTransactionWithBip32Key',
          args: ['aabb', addressKey, reviewJson],
        },
      ]);
    });

    it('hands key-image import the same key without touching the runtime', async () => {
      await expect(
        new CoreChainHd().getKeyImageBip32PrivateKeyHex(await payload()),
      ).resolves.toBe(addressKey);
      expect(calls).toEqual([]);
    });
  },
);
