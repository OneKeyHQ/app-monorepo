import coreTestsFixtures from '@onekeyhq/core/@tests/fixtures/coreTestsFixtures';
import CoreChainHd from '@onekeyhq/core/src/chains/starknet/CoreChainHd';
import CoreChainImported from '@onekeyhq/core/src/chains/starknet/CoreChainImported';
import { encryptImportedCredential } from '@onekeyhq/core/src/secret';
import type {
  ICoreApiNetworkInfo,
  ICoreCredentialsInfo,
} from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';

import type { KeyringSoftwareBase } from '../../base/KeyringSoftwareBase';

/*
yarn jest packages/kit-bg/src/vaults/impls/starknet/KeyringStrk20.test.ts

Covers the two Starknet-only keyring rungs. The SNIP vectors and the core
methods live in packages/core/src/chains/starknet/{viewingKey,CoreChainSoftware}
.test.ts; every value below is copied from those suites, so drift in either
layer shows up as a mismatch here.
*/

jest.mock('../../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

const CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA
const POOL_ADDRESS = '0x5678';

// OpenZeppelin derive type of the shared test mnemonic
const ACCOUNT = {
  address: '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec',
  path: "m/44'/9004'/0'/0/0",
  starkPrivateKey:
    '0x0188ec73b904cda31f0a1152ee14542d0ab7ac1ae3ec7a9a3c4f38bd0b3579d6',
};

const EXPECTED = {
  viewingKey:
    '0x0195e031668fd442f9057e4f5b22c9297e98046dfc06b2efb9083f2fd79239af',
  publicKeyX:
    '0x0775de99ba0b481868ff5513344a5f97729558afb6783033ec8fea502ec19d15',
  counter: 0,
};

const networkInfo: ICoreApiNetworkInfo = {
  networkChainCode: 'starknet',
  chainId: CHAIN_ID,
  networkId: 'starknet--sepolia',
  networkImpl: 'starknet',
  isTestnet: true,
};

const { hdCredential1 } = coreTestsFixtures;

function buildKeyring<T extends KeyringSoftwareBase>(
  prototype: object,
  coreApi: unknown,
  credentials: unknown,
): T {
  const keyring = Object.create(prototype) as T;
  // Spy through the concrete base type: jest.spyOn cannot resolve a key on an
  // unresolved generic parameter.
  const base: KeyringSoftwareBase = keyring;
  Object.defineProperties(base, {
    coreApi: { value: coreApi, writable: true },
    vault: {
      value: {
        getAccount: async () => ({
          address: ACCOUNT.address,
          path: ACCOUNT.path,
        }),
        getAddressEncoding: async () => EAddressEncodings.STARKNET_OZ,
      },
      writable: true,
    },
  });
  jest
    .spyOn(base, 'baseGetCredentialsInfo')
    .mockResolvedValue(credentials as ICoreCredentialsInfo);
  jest.spyOn(base, 'getCoreApiNetworkInfo').mockResolvedValue(networkInfo);
  return keyring;
}

describe('Starknet keyring baseDeriveStrk20ViewingKey', () => {
  it('derives the fixture viewing key through KeyringHd', async () => {
    const keyring = buildKeyring<KeyringHd>(
      KeyringHd.prototype,
      new CoreChainHd(),
      {
        hd: hdCredential1.hdCredentialHex,
      },
    );

    await expect(
      keyring.deriveStrk20ViewingKey({
        password: hdCredential1.password,
        chainId: CHAIN_ID,
        accountAddress: ACCOUNT.address,
        poolAddress: POOL_ADDRESS,
      }),
    ).resolves.toEqual(EXPECTED);
  });

  it('derives the same key through KeyringImported', async () => {
    const keyring = buildKeyring<KeyringImported>(
      KeyringImported.prototype,
      new CoreChainImported(),
      {
        imported: await encryptImportedCredential({
          password: hdCredential1.password,
          credential: { privateKey: ACCOUNT.starkPrivateKey },
        }),
      },
    );

    await expect(
      keyring.deriveStrk20ViewingKey({
        password: hdCredential1.password,
        chainId: CHAIN_ID,
        accountAddress: ACCOUNT.address,
        poolAddress: POOL_ADDRESS,
      }),
    ).resolves.toEqual(EXPECTED);
  });

  it('forwards the whole payload to the core api', async () => {
    const deriveStrk20ViewingKey = jest.fn().mockResolvedValue(EXPECTED);
    const keyring = buildKeyring<KeyringHd>(
      KeyringHd.prototype,
      { deriveStrk20ViewingKey },
      { hd: hdCredential1.hdCredentialHex },
    );

    await keyring.deriveStrk20ViewingKey({
      password: hdCredential1.password,
      chainId: CHAIN_ID,
      accountAddress: ACCOUNT.address,
      poolAddress: POOL_ADDRESS,
      keyIndex: 3,
    });

    expect(deriveStrk20ViewingKey).toHaveBeenCalledWith({
      networkInfo,
      password: hdCredential1.password,
      credentials: { hd: hdCredential1.hdCredentialHex },
      account: { address: ACCOUNT.address, path: ACCOUNT.path },
      addressEncoding: EAddressEncodings.STARKNET_OZ,
      chainId: CHAIN_ID,
      accountAddress: ACCOUNT.address,
      poolAddress: POOL_ADDRESS,
      keyIndex: 3,
    });
  });

  it('throws instead of deriving when the core api is missing', async () => {
    const keyring = buildKeyring<KeyringHd>(KeyringHd.prototype, undefined, {
      hd: hdCredential1.hdCredentialHex,
    });

    await expect(
      keyring.deriveStrk20ViewingKey({
        password: hdCredential1.password,
        chainId: CHAIN_ID,
        accountAddress: ACCOUNT.address,
        poolAddress: POOL_ADDRESS,
      }),
    ).rejects.toThrow('coreApi is not defined');
  });
});

/* The proof-invocation rung. Golden values are CoreChainSoftware.test.ts's. */
const SEPOLIA_POOL_ADDRESS =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
const PROOF_INVOCATION = {
  poolAddress: SEPOLIA_POOL_ADDRESS,
  version: '0x3' as const,
  calls: [
    {
      contractAddress: SEPOLIA_POOL_ADDRESS,
      entrypoint: 'compile_actions',
      calldata: [
        '0x157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec',
        '0x195e031668fd442f9057e4f5b22c9297e98046dfc06b2efb9083f2fd79239af',
        '0x0',
      ],
    },
  ],
  chainId: CHAIN_ID,
  nonce: '0x7',
  accountDeploymentData: [],
  nonceDataAvailabilityMode: 'L1' as const,
  feeDataAvailabilityMode: 'L1' as const,
  resourceBounds: {
    l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    l2_gas: { max_amount: '0x1c9c380', max_price_per_unit: '0x5af3107a4000' },
    l1_data_gas: { max_amount: '0x400', max_price_per_unit: '0x2540be400' },
  },
  tip: '0x0',
  paymasterData: [],
};
const PROOF_INVOCATION_SIGNATURE = [
  '0x3b4ff38253cddd6700ee7325dd9cd37fb8346acf0d8b6f09e5b6c658da62968',
  '0x297c3deeefca855cfec309267cd02b43c7957022d1292f074cd4d75e3457c27',
];

describe('Starknet keyring baseSignStrk20ProofInvocation', () => {
  it('produces the pool-sender signature through KeyringHd', async () => {
    const keyring = buildKeyring<KeyringHd>(
      KeyringHd.prototype,
      new CoreChainHd(),
      { hd: hdCredential1.hdCredentialHex },
    );

    await expect(
      keyring.signStrk20ProofInvocation({
        password: hdCredential1.password,
        invocation: PROOF_INVOCATION,
      }),
    ).resolves.toEqual(PROOF_INVOCATION_SIGNATURE);
  });

  it('forwards the invocation untouched to the core api', async () => {
    const signStrk20ProofInvocation = jest
      .fn()
      .mockResolvedValue(PROOF_INVOCATION_SIGNATURE);
    const keyring = buildKeyring<KeyringImported>(
      KeyringImported.prototype,
      { signStrk20ProofInvocation },
      { hd: hdCredential1.hdCredentialHex },
    );

    await keyring.signStrk20ProofInvocation({
      password: hdCredential1.password,
      invocation: PROOF_INVOCATION,
    });

    expect(signStrk20ProofInvocation).toHaveBeenCalledWith({
      networkInfo,
      password: hdCredential1.password,
      credentials: { hd: hdCredential1.hdCredentialHex },
      account: { address: ACCOUNT.address, path: ACCOUNT.path },
      addressEncoding: EAddressEncodings.STARKNET_OZ,
      invocation: PROOF_INVOCATION,
    });
  });
});
