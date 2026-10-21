import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import { EMessageTypesStarknet } from '@onekeyhq/shared/types/message';

import coreTestsUtils from '../../../@tests/coreTestsUtils';
import coreTestsFixtures from '../../../@tests/fixtures/coreTestsFixtures';
import { encryptImportedCredential } from '../../secret';
import { ECoreApiExportedSecretKeyType } from '../../types';

import CoreChainHd from './CoreChainHd';
import CoreChainImported from './CoreChainImported';
import sdkStarknet from './sdkStarknet';

import type { IEncodedTxStarknet, IStarknetRawTx } from './types';
import type {
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../../types';

/*
yarn jest packages/core/src/chains/starknet/CoreChainSoftware.test.ts

Every expected value below was produced offline with starknet@10.8.0 itself
(scripted against the unpacked package, no network), using this repo's own
test mnemonic from coreTestsFixtures, so the vectors are the library's output
rather than hand-written constants:

  seed      = bip39.mnemonicToSeedSync(<coreTestsFixtures mnemonic>, '')
  child     = HDKey.fromMasterSeed(seed).derive("m/44'/9004'/0'/0/<i>")
  starkPk   = '0x' + ec.starkCurve.grindKey(child.privateKey)
  publicKey = ec.starkCurve.getStarkKey(starkPk)
  address   = validateAndParseAddress(hash.calculateContractAddressFromHash(
                publicKey, OZ_CLASS_HASH, CallData.compile({ publicKey }), 0))

The BIP-32 half of that script was cross-checked by re-deriving m/44'/60'/0'/0/0
from the same mnemonic and matching the EVM address recorded in
coreTestsFixtures (0x1959f5f4979c5cd87d5cb75c678c770515cb5e0e).
*/

const { hdCredential, networkInfo, hdAccountTemplate, hdAccounts } =
  coreTestsFixtures.prepareCoreChainTestsFixtures({
    networkInfo: {
      networkChainCode: 'starknet',
      chainId: '0x534e5f5345504f4c4941',
      networkId: 'starknet--sepolia',
      networkImpl: 'starknet',
      isTestnet: true,
    },
    hdAccountTemplate: "m/44'/9004'/0'/0/$$INDEX$$",
    hdAccounts: [
      {
        address:
          '0x00f1ae5f5976da6f374a5cc06c77bf9c9f7341e02be6913889fccc382bf09673',
        path: "m/44'/9004'/0'/0/0",
        publicKey:
          '0x75b8797ee6603cbd9585b6f4b30dea9b362642489ce3e3d578ee36223d7a7e4',
        // Stark private key (grindKey of the secp256k1 child key), which is
        // what getPrivateKeys and getExportedSecretKey both return
        privateKeyRaw:
          '0188ec73b904cda31f0a1152ee14542d0ab7ac1ae3ec7a9a3c4f38bd0b3579d6',
      },
      {
        address:
          '0x03c1ac9919eb6f216d098e8ec7841b28ab11f7a7ce3011307817d7a345381a7d',
        path: "m/44'/9004'/0'/0/1",
        publicKey:
          '0x77f95904f553e03f4909114cac9f3c43d1ae5ddfcf9d4036d4e784381c25a92',
        privateKeyRaw:
          '056ec389ddd1a0d952ea021912e8999eab0b9edd8bfbfb4c251dc2feb8c179ac',
      },
    ],
    txSamples: [],
    msgSamples: [],
  });

// the vectors above are the OpenZeppelin derive type; Argent has its own below
const OZ_ENCODING = EAddressEncodings.STARKNET_OZ;

const account0 = hdAccounts[0];
const STARK_PRIVATE_KEY_0 =
  '0x0188ec73b904cda31f0a1152ee14542d0ab7ac1ae3ec7a9a3c4f38bd0b3579d6';

const RESOURCE_BOUNDS = {
  l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
  l2_gas: { max_amount: '0x1c9c380', max_price_per_unit: '0x5af3107a4000' },
  l1_data_gas: { max_amount: '0x400', max_price_per_unit: '0x2540be400' },
};

const encodedTx: IEncodedTxStarknet = {
  chainId: '0x534e5f5345504f4c4941',
  from: account0.address,
  version: '0x3',
  nonce: '0x0',
  calls: [
    {
      contractAddress:
        '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
      entrypoint: 'transfer',
      calldata: ['0x1234', '0x64', '0x0'],
    },
  ],
  resourceBounds: RESOURCE_BOUNDS,
  tip: '0x0',
  paymasterData: [],
  accountDeploymentData: [],
  nonceDataAvailabilityMode: 'L1',
  feeDataAvailabilityMode: 'L1',
};

const INVOKE_TX_HASH =
  '0x790d1ac9b4e60c89fe217d5d052a6cb7b6f08e73839e8718c4266415ed1f903';
const INVOKE_SIGNATURE = [
  '0x6a912e8d5bde40d3ea22e4014ca1ac63064dd1dfa972ccc41a87fa9436a4857',
  '0x4e6c45419830cf00ac2b35a8bf2ce752254575474affecfe46c06666a16d87c',
];
const DEPLOY_ACCOUNT_TX_HASH =
  '0x6e8d9328dab5e07cbce6b8be1db3d90f6a1a71f8c7a94ca2e1034c9776eff1b';
const DEPLOY_ACCOUNT_SIGNATURE = [
  '0x6aa1c1b6d0935a5c47d9c100f80d3bff68c25d042883f83a94a4e90d629c013',
  '0x13bf54012490334437ed78b4fa624bec1d3b29f03e15f2ff6a3b035e50fee60',
];

const buildSignTxPayload = (tx: IEncodedTxStarknet): ICoreApiSignTxPayload => ({
  networkInfo,
  password: hdCredential.password,
  credentials: { hd: hdCredential.hdCredentialHex },
  addressEncoding: OZ_ENCODING,
  account: {
    address: account0.address,
    path: account0.path,
    pub: account0.publicKey,
    pubKey: account0.publicKey,
  },
  unsignedTx: { encodedTx: tx },
});

const TYPED_DATA = {
  domain: {
    name: 'OneKey',
    chainId: 'SN_SEPOLIA',
    version: '1',
    revision: '1',
  },
  primaryType: 'Message',
  types: {
    StarknetDomain: [
      { name: 'name', type: 'shortstring' },
      { name: 'chainId', type: 'shortstring' },
      { name: 'version', type: 'shortstring' },
      { name: 'revision', type: 'shortstring' },
    ],
    Message: [{ name: 'content', type: 'shortstring' }],
  },
  message: { content: 'hello' },
};
const TYPED_DATA_SIGNATURE = [
  '0x896f00bfb07d78fc9fa97927a53929d327f6e4282faae4d0acc3fbf9c2fa22',
  '0x7ebcef27e2b041fedf124e7c4b013b685b3f0854b3e6718e8522de4a3ffa0a',
];

// RPC felts: 0x-hex, lowercase, no leading zeros (spec pattern for FELT)
const HEX_FELT = /^0x[0-9a-f]+$/;
const SPEC_FELT = /^0x(0|[a-f1-9][a-f0-9]{0,62})$/;
const expectFelts = (values: string[]) => {
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value).toMatch(HEX_FELT);
    expect(value).toMatch(SPEC_FELT);
  }
};

describe('Starknet Core tests', () => {
  it('mnemonic verify', async () => {
    await coreTestsUtils.expectMnemonicValid({ hdCredential });
  });

  it('getAddressFromPublic', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromPublicOk({
      coreApi,
      networkInfo,
      hdAccounts,
      addressEncoding: OZ_ENCODING,
    });
  });

  it('getAddressesFromHd', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdAccountTemplate,
      hdCredential,
      addressEncoding: OZ_ENCODING,
    });
  });

  it('getPrivateKeys returns Stark keys for HD credentials', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetPrivateKeysHdOk({
      coreApi,
      networkInfo,
      hdAccounts,
      hdCredential,
      addressEncoding: OZ_ENCODING,
    });
  });

  it('getAddressFromPrivate round-trips those same Stark keys', async () => {
    const coreApi = new CoreChainImported();
    await coreTestsUtils.expectGetAddressFromPrivateOk({
      coreApi,
      networkInfo,
      hdAccounts,
      addressEncoding: OZ_ENCODING,
    });
  });

  it('getAddressFromPrivate takes a Stark private key, not a secp256k1 one', async () => {
    const coreApi = new CoreChainImported();
    const result = await coreApi.getAddressFromPrivate({
      networkInfo,
      privateKeyRaw: STARK_PRIVATE_KEY_0,
      addressEncoding: OZ_ENCODING,
    });
    expect(result.publicKey).toBe(account0.publicKey);
    expect(result.address).toBe(account0.address);

    // unpadded felt form of the same key resolves identically
    const unpadded = await coreApi.getAddressFromPrivate({
      networkInfo,
      addressEncoding: OZ_ENCODING,
      privateKeyRaw:
        '0x188ec73b904cda31f0a1152ee14542d0ab7ac1ae3ec7a9a3c4f38bd0b3579d6',
    });
    expect(unpadded.address).toBe(account0.address);
  });

  it('rejects Stark private keys outside [1, curve order)', () => {
    const curveOrder =
      '0x0800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f';
    expect(() => sdkStarknet.normalizeStarkPrivateKey(curveOrder)).toThrow();
    expect(() => sdkStarknet.normalizeStarkPrivateKey('0x0')).toThrow();
    expect(() =>
      sdkStarknet.normalizeStarkPrivateKey(`0x${'f'.repeat(64)}`),
    ).toThrow();
    // one below the curve order is accepted
    expect(
      sdkStarknet.normalizeStarkPrivateKey(
        '0x0800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2e',
      ),
    ).toBe(
      '0x0800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2e',
    );
  });

  it('derives the address from the OpenZeppelin deploy params', () => {
    const params = sdkStarknet.getAccountDeployParams(
      account0.publicKey,
      'openZeppelin',
    );
    expect(params.classHash).toBe(sdkStarknet.OPENZEPPELIN_ACCOUNT_CLASS_HASH);
    expect(params.addressSalt).toBe(account0.publicKey);
    expect(params.constructorCalldata).toHaveLength(1);
    expectFelts(params.constructorCalldata);
    expectFelts([params.addressSalt, params.classHash]);
    expect(params.contractAddress).toBe(account0.address);
  });

  it('signTransaction produces the invoke v3 hash and signature', async () => {
    const coreApi = new CoreChainHd();
    const signedTx = await coreApi.signTransaction(
      buildSignTxPayload(encodedTx),
    );
    expect(signedTx.txid).toBe(INVOKE_TX_HASH);

    const rawTx = JSON.parse(signedTx.rawTx) as IStarknetRawTx;
    expect(rawTx.invoke.type).toBe('INVOKE');
    expect(rawTx.invoke.signature).toEqual(INVOKE_SIGNATURE);
    expect(rawTx.deployAccount).toBeUndefined();
    // sender_address is the same felt as the account, in RPC form: the padded
    // address the account carries has leading zeros the FELT pattern forbids
    expect(BigInt(rawTx.invoke.sender_address)).toBe(BigInt(account0.address));
  });

  it('emits every rawTx felt as 0x-hex, never decimal', async () => {
    const coreApi = new CoreChainHd();
    const deployParams = sdkStarknet.getAccountDeployParams(
      account0.publicKey,
      'openZeppelin',
    );
    const signedTx = await coreApi.signTransaction(
      buildSignTxPayload({
        ...encodedTx,
        deployAccount: {
          classHash: deployParams.classHash,
          constructorCalldata: deployParams.constructorCalldata,
          addressSalt: deployParams.addressSalt,
          nonce: '0x0',
          resourceBounds: RESOURCE_BOUNDS,
        },
      }),
    );
    const { invoke, deployAccount } = JSON.parse(
      signedTx.rawTx,
    ) as IStarknetRawTx;

    expectFelts(invoke.calldata);
    expectFelts(deployAccount?.constructor_calldata ?? []);
    expectFelts([
      invoke.sender_address,
      invoke.nonce,
      invoke.tip,
      ...invoke.signature,
      invoke.resource_bounds.l1_gas.max_amount,
      invoke.resource_bounds.l1_gas.max_price_per_unit,
      invoke.resource_bounds.l2_gas.max_amount,
      invoke.resource_bounds.l2_gas.max_price_per_unit,
      invoke.resource_bounds.l1_data_gas.max_amount,
      invoke.resource_bounds.l1_data_gas.max_price_per_unit,
    ]);
    expectFelts([
      deployAccount?.class_hash ?? '',
      deployAccount?.contract_address_salt ?? '',
      deployAccount?.nonce ?? '',
      ...(deployAccount?.signature ?? []),
    ]);
    // the DA modes are enum strings, not felts
    expect(invoke.nonce_data_availability_mode).toBe('L1');
    expect(invoke.fee_data_availability_mode).toBe('L1');
  });

  it('signTransaction also signs the counterfactual deploy_account', async () => {
    const coreApi = new CoreChainHd();
    const deployParams = sdkStarknet.getAccountDeployParams(
      account0.publicKey,
      'openZeppelin',
    );
    const signedTx = await coreApi.signTransaction(
      buildSignTxPayload({
        ...encodedTx,
        deployAccount: {
          classHash: deployParams.classHash,
          constructorCalldata: deployParams.constructorCalldata,
          addressSalt: deployParams.addressSalt,
          nonce: '0x0',
          resourceBounds: RESOURCE_BOUNDS,
        },
      }),
    );
    expect(signedTx.txid).toBe(INVOKE_TX_HASH);

    const rawTx = JSON.parse(signedTx.rawTx) as IStarknetRawTx;
    expect(rawTx.deployAccountTxHash).toBe(DEPLOY_ACCOUNT_TX_HASH);
    expect(rawTx.deployAccount?.signature).toEqual(DEPLOY_ACCOUNT_SIGNATURE);
    expect(rawTx.deployAccount?.class_hash).toBe(
      sdkStarknet.OPENZEPPELIN_ACCOUNT_CLASS_HASH,
    );
  });

  it('signMessage signs SNIP-12 typed data', async () => {
    const coreApi = new CoreChainHd();
    const payload: ICoreApiSignMsgPayload = {
      networkInfo,
      password: hdCredential.password,
      credentials: { hd: hdCredential.hdCredentialHex },
      addressEncoding: OZ_ENCODING,
      account: {
        address: account0.address,
        path: account0.path,
        pub: account0.publicKey,
        pubKey: account0.publicKey,
      },
      unsignedMsg: {
        type: EMessageTypesStarknet.SIGN_TYPED_DATA,
        message: JSON.stringify(TYPED_DATA),
      },
    };
    const signature = await coreApi.signMessage(payload);
    expect(JSON.parse(signature)).toEqual(TYPED_DATA_SIGNATURE);
  });

  it('signMessage rejects payloads that are not SNIP-12 typed data', async () => {
    const coreApi = new CoreChainHd();
    const payload: ICoreApiSignMsgPayload = {
      networkInfo,
      password: hdCredential.password,
      credentials: { hd: hdCredential.hdCredentialHex },
      addressEncoding: OZ_ENCODING,
      account: {
        address: account0.address,
        path: account0.path,
      },
      unsignedMsg: {
        type: EMessageTypesStarknet.SIGN_TYPED_DATA,
        message: 'hello world',
      },
    };
    await expect(coreApi.signMessage(payload)).rejects.toThrow();
  });

  it('getExportedSecretKey returns the Stark private key for both credential types', async () => {
    const hdApi = new CoreChainHd();
    const exportedHd = await hdApi.getExportedSecretKey({
      networkInfo,
      password: hdCredential.password,
      credentials: { hd: hdCredential.hdCredentialHex },
      addressEncoding: OZ_ENCODING,
      account: { address: account0.address, path: account0.path },
      keyType: ECoreApiExportedSecretKeyType.privateKey,
    });
    expect(exportedHd).toBe(STARK_PRIVATE_KEY_0);

    const importedApi = new CoreChainImported();
    const exportedImported = await importedApi.getExportedSecretKey({
      networkInfo,
      password: hdCredential.password,
      credentials: {
        imported: await encryptImportedCredential({
          password: hdCredential.password,
          credential: { privateKey: STARK_PRIVATE_KEY_0 },
        }),
      },
      account: { address: account0.address, path: account0.path },
      keyType: ECoreApiExportedSecretKeyType.privateKey,
    });
    expect(exportedImported).toBe(STARK_PRIVATE_KEY_0);
  });
});

/*
STRK20. Every hash below came from the same offline starknet@10.8.0 script as the
vectors above, so they are the library's output and not hand-written constants.
*/
const SEPOLIA_POOL_ADDRESS =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
const PROOF_FACTS = ['0x1a2b', '0x3c4d', '0x5e6f'];
const INVOKE_TX_HASH_WITH_PROOF_FACTS =
  '0x6e957ab422edb59d23331369e1a1f8a4d344918d61edda651764681ea74cdba';
const INVOKE_SIGNATURE_WITH_PROOF_FACTS = [
  '0x7ab0013dab4207ec33d96f8c087a296131522b7e176aa8e172cc64898bb7bd2',
  '0x665d3c433fd769ed8f671db962a1298ee3fd4ba6040f7a79a00150b3355c042',
];

// one compile_actions call on the pool, the only thing the SDK asks us to sign
const PROOF_INVOCATION_CALLS = [
  {
    contractAddress: SEPOLIA_POOL_ADDRESS,
    entrypoint: 'compile_actions',
    calldata: [
      '0x157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec',
      '0x195e031668fd442f9057e4f5b22c9297e98046dfc06b2efb9083f2fd79239af',
      '0x0',
    ],
  },
];
const PROOF_INVOCATION_NONCE = '0x7';
const PROOF_INVOCATION_SIGNATURE = [
  '0x3b4ff38253cddd6700ee7325dd9cd37fb8346acf0d8b6f09e5b6c658da62968',
  '0x297c3deeefca855cfec309267cd02b43c7957022d1292f074cd4d75e3457c27',
];
// same call and nonce hashed with the ACCOUNT as sender: must never be signed
const PROOF_INVOCATION_WRONG_SENDER_HASH =
  '0x25a1332fe2ce19ef6ce886e28f00dda5e41c01675fa7fa908160944977d15fb';

const privacyBlock = {
  poolAddress: SEPOLIA_POOL_ADDRESS,
  kind: 'transfer' as const,
  proofFacts: PROOF_FACTS,
  proof: '0xdeadbeef',
  provingBlockId: 1_000_000,
  builtAt: 1_758_000_000_000,
};

describe('Starknet STRK20 proof facts and proof invocation', () => {
  it('leaves the invoke hash untouched when no proof facts are present', () => {
    const withoutField = sdkStarknet.calculateInvokeTxHash({
      senderAddress: encodedTx.from,
      version: encodedTx.version,
      calls: encodedTx.calls,
      chainId: encodedTx.chainId,
      nonce: encodedTx.nonce,
      accountDeploymentData: encodedTx.accountDeploymentData,
      nonceDataAvailabilityMode: encodedTx.nonceDataAvailabilityMode,
      feeDataAvailabilityMode: encodedTx.feeDataAvailabilityMode,
      resourceBounds: encodedTx.resourceBounds,
      tip: encodedTx.tip,
      paymasterData: encodedTx.paymasterData,
    });
    const withEmptyList = sdkStarknet.calculateInvokeTxHash({
      senderAddress: encodedTx.from,
      version: encodedTx.version,
      calls: encodedTx.calls,
      chainId: encodedTx.chainId,
      nonce: encodedTx.nonce,
      accountDeploymentData: encodedTx.accountDeploymentData,
      nonceDataAvailabilityMode: encodedTx.nonceDataAvailabilityMode,
      feeDataAvailabilityMode: encodedTx.feeDataAvailabilityMode,
      resourceBounds: encodedTx.resourceBounds,
      tip: encodedTx.tip,
      paymasterData: encodedTx.paymasterData,
      proofFacts: [],
    });

    expect(withoutField.txHash).toBe(INVOKE_TX_HASH);
    expect(withEmptyList.txHash).toBe(INVOKE_TX_HASH);
  });

  it('changes the invoke hash when proof facts are present', () => {
    const { txHash } = sdkStarknet.calculateInvokeTxHash({
      senderAddress: encodedTx.from,
      version: encodedTx.version,
      calls: encodedTx.calls,
      chainId: encodedTx.chainId,
      nonce: encodedTx.nonce,
      accountDeploymentData: encodedTx.accountDeploymentData,
      nonceDataAvailabilityMode: encodedTx.nonceDataAvailabilityMode,
      feeDataAvailabilityMode: encodedTx.feeDataAvailabilityMode,
      resourceBounds: encodedTx.resourceBounds,
      tip: encodedTx.tip,
      paymasterData: encodedTx.paymasterData,
      proofFacts: PROOF_FACTS,
    });

    expect(txHash).toBe(INVOKE_TX_HASH_WITH_PROOF_FACTS);
    expect(txHash).not.toBe(INVOKE_TX_HASH);
  });

  it('signTransaction signs the proof-facts hash and carries proof beside it', async () => {
    const coreApi = new CoreChainHd();
    const signed = await coreApi.signTransaction(
      buildSignTxPayload({ ...encodedTx, privacy: privacyBlock }),
    );
    const rawTx = JSON.parse(signed.rawTx) as IStarknetRawTx;

    expect(signed.txid).toBe(INVOKE_TX_HASH_WITH_PROOF_FACTS);
    expect(rawTx.invoke.signature).toEqual(INVOKE_SIGNATURE_WITH_PROOF_FACTS);
    expect(rawTx.invoke.proof_facts).toEqual(PROOF_FACTS);
    // the proof is not hashed, so it travels on the raw tx, not on the invoke
    expect(rawTx.proof).toBe('0xdeadbeef');
    expect(rawTx.invoke).not.toHaveProperty('proof');
  });

  it('signTransaction is byte-identical to Phase 1 without the privacy block', async () => {
    const coreApi = new CoreChainHd();
    const signed = await coreApi.signTransaction(buildSignTxPayload(encodedTx));
    const rawTx = JSON.parse(signed.rawTx) as IStarknetRawTx;

    expect(signed.txid).toBe(INVOKE_TX_HASH);
    expect(rawTx.invoke.signature).toEqual(INVOKE_SIGNATURE);
    expect(rawTx.invoke).not.toHaveProperty('proof_facts');
    expect(rawTx).not.toHaveProperty('proof');
  });

  it('signStrk20ProofInvocation signs with the POOL as sender', async () => {
    const coreApi = new CoreChainHd();
    const signature = await coreApi.signStrk20ProofInvocation({
      networkInfo,
      password: hdCredential.password,
      credentials: { hd: hdCredential.hdCredentialHex },
      addressEncoding: OZ_ENCODING,
      account: { address: account0.address, path: account0.path },
      invocation: {
        poolAddress: SEPOLIA_POOL_ADDRESS,
        version: '0x3',
        calls: PROOF_INVOCATION_CALLS,
        chainId: encodedTx.chainId,
        nonce: PROOF_INVOCATION_NONCE,
        accountDeploymentData: [],
        nonceDataAvailabilityMode: 'L1',
        feeDataAvailabilityMode: 'L1',
        resourceBounds: RESOURCE_BOUNDS,
        tip: '0x0',
        paymasterData: [],
      },
    });

    expect(signature).toEqual(PROOF_INVOCATION_SIGNATURE);
    // the account-as-sender hash is a different message, so a shim that assumed
    // "sender == my address" would produce a signature the pool rejects
    expect(signature).not.toEqual(
      sdkStarknet.signHash(
        PROOF_INVOCATION_WRONG_SENDER_HASH,
        STARK_PRIVATE_KEY_0,
      ),
    );
  });
});

/*
Argent derive type (the default). Expected values come from a script that
replays Argent X's own code line for line: ethers Wallet.fromMnemonic for the
Ethereum key, @scure/bip32 HDKey.fromMasterSeed on that key as Argent's
ArgentSigner does, @scure/starknet grindKey, and the @argent/x-shared v0.4.0
constructor (Signer::Starknet owner, no guardian). That script reproduces the
two vectors in argent-x packages/extension/test/keyDerivation.test.ts, and its
Ethereum key matches the EVM address recorded in coreTestsFixtures.
*/
const argentHdAccounts: typeof hdAccounts = [
  {
    address:
      '0x0341ddbc8c03c39c40bf3062e4c39670957d9945b5140f045114d7425490fb10',
    path: "m/44'/9004'/0'/0/0",
    publicKey:
      '0x110885de433bb4a6a48f2a17cf2c3b260857b8d812e20c6b14f38c2ef9df72c',
    privateKeyRaw:
      '026bc60675deb071acb5c04aba2db0621f8b83cf0dd8600d609e303bb7390e04',
  },
  {
    address:
      '0x00ab91cff98b05c3f4f43517905a7672310e65fb6563089eb6eeda6c61f157cb',
    path: "m/44'/9004'/0'/0/1",
    publicKey:
      '0x62257aaba55fe9f171abbf635ad8d4c398f8d1cfab983f5c35b5afa3be23e65',
    privateKeyRaw:
      '04ba6b2fb3233d3546fd1d1a0a22ebe4803dbc8610f436a2656d038cda80a264',
  },
];
const argentAccount0 = argentHdAccounts[0];

describe('Starknet Argent derive type', () => {
  it('reproduces the Argent X key derivation vectors', () => {
    const secret = Buffer.from(
      'e6904d63affe7a13cd30345b000c9b1ffc087832332d7303cf237ffda8a177d0',
      'hex',
    );
    const starkKeyAt = (index: number) =>
      BigInt(
        sdkStarknet.getStarkPublicKey(
          sdkStarknet.deriveArgentStarkPrivateKey(
            secret,
            `m/44'/9004'/0'/0/${index}`,
          ),
        ),
      );
    expect(starkKeyAt(5)).toBe(
      BigInt(
        '0x05c7c65bfda7a85af0681c85c9c440f0aa6825feef6f9c96e55fb2ce08c8d4bc',
      ),
    );
    expect(starkKeyAt(7)).toBe(
      BigInt(
        '0x0605d5a0ece3b316f0d72221228acb7f01dcb34db74e0c02790db156741f5a86',
      ),
    );
  });

  it('drops leading zero bytes of the seed key, as Argent X does', () => {
    const secret = Buffer.from(`00${'a1'.repeat(31)}`, 'hex');
    expect(
      sdkStarknet.deriveArgentStarkPrivateKey(secret, "m/44'/9004'/0'/0/0"),
    ).toBe(
      '0x06344023239e162fec7b520e1cc14390479e3ae8bbcc5621ab9f70b05023c4c1',
    );
  });

  it('matches the address of a live mainnet Argent v0.4.0 account', () => {
    // owner read with get_owner() from the deployed account
    expect(
      BigInt(
        sdkStarknet.getAddressFromStarkPublicKey(
          '0x6748c17884d1b0df68ac1e10bd86c7ff5d1c8a79e5564ab4d148b00eae3d2af',
          'argent',
        ),
      ),
    ).toBe(
      BigInt(
        '0x39d8779e4018a47cc470fb995ac54776a664e1427f7ca817288d793c787fa71',
      ),
    );
  });

  it('builds Argent deploy params with an owner and no guardian', () => {
    const params = sdkStarknet.getAccountDeployParams(
      argentAccount0.publicKey,
      'argent',
    );
    expect(params.classHash).toBe(sdkStarknet.ARGENT_ACCOUNT_CLASS_HASH);
    expect(params.addressSalt).toBe(argentAccount0.publicKey);
    expect(params.constructorCalldata).toEqual([
      '0x0',
      argentAccount0.publicKey,
      '0x1',
    ]);
    expect(params.contractAddress).toBe(argentAccount0.address);
  });

  it('getAddressesFromHd defaults to Argent', async () => {
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi: new CoreChainHd(),
      networkInfo,
      hdAccounts: argentHdAccounts,
      hdAccountTemplate,
      hdCredential,
    });
  });

  it('getPrivateKeys and getExportedSecretKey return the Argent Stark key', async () => {
    const coreApi = new CoreChainHd();
    await coreTestsUtils.expectGetPrivateKeysHdOk({
      coreApi,
      networkInfo,
      hdAccounts: argentHdAccounts,
      hdCredential,
    });
    const exported = await coreApi.getExportedSecretKey({
      networkInfo,
      password: hdCredential.password,
      credentials: { hd: hdCredential.hdCredentialHex },
      account: { address: argentAccount0.address, path: argentAccount0.path },
      keyType: ECoreApiExportedSecretKeyType.privateKey,
    });
    expect(exported).toBe(`0x${argentAccount0.privateKeyRaw}`);
  });

  it('imported Stark keys take the Argent address by default', async () => {
    const result = await new CoreChainImported().getAddressFromPrivate({
      networkInfo,
      privateKeyRaw: `0x${argentAccount0.privateKeyRaw}`,
    });
    expect(result.address).toBe(argentAccount0.address);
  });

  it('signTransaction signs invoke and deploy with the Argent key', async () => {
    const deployParams = sdkStarknet.getAccountDeployParams(
      argentAccount0.publicKey,
      'argent',
    );
    const signedTx = await new CoreChainHd().signTransaction({
      networkInfo,
      password: hdCredential.password,
      credentials: { hd: hdCredential.hdCredentialHex },
      account: {
        address: argentAccount0.address,
        path: argentAccount0.path,
        pub: argentAccount0.publicKey,
        pubKey: argentAccount0.publicKey,
      },
      unsignedTx: {
        encodedTx: {
          ...encodedTx,
          from: argentAccount0.address,
          deployAccount: {
            classHash: deployParams.classHash,
            constructorCalldata: deployParams.constructorCalldata,
            addressSalt: deployParams.addressSalt,
            nonce: '0x0',
            resourceBounds: RESOURCE_BOUNDS,
          },
        },
      },
    });
    const rawTx = JSON.parse(signedTx.rawTx) as IStarknetRawTx;
    const argentKey = `0x${argentAccount0.privateKeyRaw}`;
    expect(rawTx.invoke.signature).toEqual(
      sdkStarknet.signHash(signedTx.txid, argentKey),
    );
    expect(rawTx.deployAccount?.signature).toEqual(
      sdkStarknet.signHash(rawTx.deployAccountTxHash ?? '', argentKey),
    );
    expect(rawTx.deployAccount?.class_hash).toBe(
      sdkStarknet.toFelt(sdkStarknet.ARGENT_ACCOUNT_CLASS_HASH),
    );
  });
});

/*
OKX derive type. OKX seeds BIP32 with the Ethereum account key like Argent X,
so for this mnemonic (whose key has no leading zero byte) the Stark keys equal
the Argent ones above; only the account contract differs. Addresses computed
with starknet@10.8.0 calculateContractAddressFromHash(publicKey,
OKX_ACCOUNT_CLASS_HASH, [publicKey, 0], 0).
*/
const OKX_ENCODING = EAddressEncodings.STARKNET_OKX;
const okxHdAccounts = [
  {
    ...argentHdAccounts[0],
    address:
      '0x06d0153fe82dceab2147fad97fa2085e2120427f7c119530a9dd414abaeb2ed9',
  },
  {
    ...argentHdAccounts[1],
    address:
      '0x054c7a459ac0eb15ffa1f4178171f76cfba93d2e1569404020402584e9524baf',
  },
];
const okxAccount0 = okxHdAccounts[0];

describe('Starknet OKX derive type', () => {
  it('keeps the leading zero byte of the seed key, unlike Argent X', () => {
    const secret = Buffer.from(`00${'a1'.repeat(31)}`, 'hex');
    const okxKey = sdkStarknet.deriveOkxStarkPrivateKey(
      secret,
      "m/44'/9004'/0'/0/0",
    );
    expect(okxKey).toBe(
      '0x02e38186f5fab24754e53a3f5230c4e2d002ff288682e5e5e3a0df109df65b74',
    );
    expect(okxKey).not.toBe(
      sdkStarknet.deriveArgentStarkPrivateKey(secret, "m/44'/9004'/0'/0/0"),
    );
  });

  it('builds OKX deploy params with an owner and no guardian', () => {
    const params = sdkStarknet.getAccountDeployParams(
      okxAccount0.publicKey,
      'okx',
    );
    expect(params.classHash).toBe(sdkStarknet.OKX_ACCOUNT_CLASS_HASH);
    expect(params.addressSalt).toBe(okxAccount0.publicKey);
    expect(params.constructorCalldata).toEqual([okxAccount0.publicKey, '0x0']);
    expect(params.contractAddress).toBe(okxAccount0.address);
  });

  it('getAddressesFromHd derives OKX addresses', async () => {
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi: new CoreChainHd(),
      networkInfo,
      hdAccounts: okxHdAccounts,
      hdAccountTemplate,
      hdCredential,
      addressEncoding: OKX_ENCODING,
    });
  });

  it('getPrivateKeys returns the OKX Stark key', async () => {
    await coreTestsUtils.expectGetPrivateKeysHdOk({
      coreApi: new CoreChainHd(),
      networkInfo,
      hdAccounts: okxHdAccounts,
      hdCredential,
      addressEncoding: OKX_ENCODING,
    });
  });

  it('imported Stark keys take the OKX address with the OKX encoding', async () => {
    const result = await new CoreChainImported().getAddressFromPrivate({
      networkInfo,
      privateKeyRaw: `0x${okxAccount0.privateKeyRaw}`,
      addressEncoding: OKX_ENCODING,
    });
    expect(result.address).toBe(okxAccount0.address);
  });
});

// TEMP(starknet-oz017): remove once funds are off OpenZeppelin v0.17.0 accounts.
// The addresses are the OZ v0.17.0 vectors this file locked before the switch
// to v1.0.0 (starknet@10.8.0, same keys as hdAccounts above).
describe('Starknet OpenZeppelin v0.17.0 derive type (temporary)', () => {
  const v017Accounts = [
    {
      ...hdAccounts[0],
      address:
        '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec',
    },
    {
      ...hdAccounts[1],
      address:
        '0x0262f49363b614f0cbb5b7f6cb879a933b332b89cddc164e602d7d62fd1cfba4',
    },
  ];

  it('derives the old v0.17.0 addresses from the same OpenZeppelin keys', async () => {
    await coreTestsUtils.expectGetAddressFromHdOk({
      coreApi: new CoreChainHd(),
      networkInfo,
      hdAccounts: v017Accounts,
      hdAccountTemplate,
      hdCredential,
      addressEncoding: EAddressEncodings.STARKNET_OZ_V017,
    });
  });

  it('deploys with the v0.17.0 class', () => {
    const params = sdkStarknet.getAccountDeployParams(
      v017Accounts[0].publicKey,
      'openZeppelinV017',
    );
    expect(params.classHash).toBe(
      sdkStarknet.OPENZEPPELIN_V017_ACCOUNT_CLASS_HASH,
    );
    expect(params.contractAddress).toBe(v017Accounts[0].address);
  });
});
