import CoreChainImported from '@onekeyhq/core/src/chains/starknet/CoreChainImported';
import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type {
  IDecodedTxExtraStarknet,
  IEncodedTxStarknet,
} from '@onekeyhq/core/src/chains/starknet/types';
import { encryptImportedCredential } from '@onekeyhq/core/src/secret';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import StarknetVault from './Vault';

// Fixtures lifted verbatim from packages/core/src/chains/starknet/
// CoreChainSoftware.test.ts, so the hash below is the one core's signer
// independently produced and locked into its own test.
const ACCOUNT_ADDRESS =
  '0x00f1ae5f5976da6f374a5cc06c77bf9c9f7341e02be6913889fccc382bf09673';
const PUBLIC_KEY =
  '0x75b8797ee6603cbd9585b6f4b30dea9b362642489ce3e3d578ee36223d7a7e4';
const RESOURCE_BOUNDS = {
  l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
  l2_gas: { max_amount: '0x1c9c380', max_price_per_unit: '0x5af3107a4000' },
  l1_data_gas: { max_amount: '0x400', max_price_per_unit: '0x2540be400' },
};
const CORE_DEPLOY_ACCOUNT_TX_HASH =
  '0x6e8d9328dab5e07cbce6b8be1db3d90f6a1a71f8c7a94ca2e1034c9776eff1b';
const CORE_INVOKE_TX_HASH =
  '0x790d1ac9b4e60c89fe217d5d052a6cb7b6f08e73839e8718c4266415ed1f903';
// published zero-value test vector from core's own test file, not anyone's funds
const FIXTURE_STARK_PRIVATE_KEY =
  '0x0188ec73b904cda31f0a1152ee14542d0ab7ac1ae3ec7a9a3c4f38bd0b3579d6';
const FIXTURE_PASSWORD = '11111111';
const STRK =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

const NETWORK = {
  id: 'starknet--sepolia',
  chainId: '0x534e5f5345504f4c4941',
  decimals: 18,
  symbol: 'STRK',
  shortname: 'TSTRK',
  logoURI: '',
  feeMeta: { decimals: 18, symbol: 'STRK' },
};

function buildEncodedTx(withDeploy: boolean): IEncodedTxStarknet {
  const deployParams = sdkStarknet.getAccountDeployParams(
    PUBLIC_KEY,
    'openZeppelin',
  );
  return {
    chainId: NETWORK.chainId,
    from: ACCOUNT_ADDRESS,
    version: '0x3',
    nonce: '0x0',
    calls: [
      {
        contractAddress: STRK,
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
    ...(withDeploy
      ? {
          deployAccount: {
            classHash: deployParams.classHash,
            constructorCalldata: deployParams.constructorCalldata,
            addressSalt: deployParams.addressSalt,
            nonce: '0x0',
            resourceBounds: RESOURCE_BOUNDS,
          },
        }
      : {}),
  };
}

function buildVault() {
  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  Object.assign(vault, {
    networkId: NETWORK.id,
    accountId: 'hd-1--test',
    getNetwork: async () => NETWORK,
    getAccountAddress: async () => ACCOUNT_ADDRESS,
    getNetworkInfo: async () => ({ nativeTokenAddress: STRK }),
    // Object.create skips class fields, so the metadata memo is stubbed here
    _getTokenMetadataCache: async () => ({
      name: 'Starknet Token',
      symbol: 'STRK',
      decimals: 18,
      logoURI: '',
      isNative: true,
    }),
    buildTxTransferAssetAction: async () => ({ type: 'ASSET_TRANSFER' }),
  });
  return vault;
}

async function decode(withDeploy: boolean) {
  return buildVault().buildDecodedTx({
    unsignedTx: { encodedTx: buildEncodedTx(withDeploy) },
  } as never);
}

describe('StarknetVault.buildDecodedTx deploy extra info', () => {
  it('recomputes the same DEPLOY_ACCOUNT hash the core signer produces', async () => {
    const decodedTx = await decode(true);
    const extraInfo = decodedTx.extraInfo as IDecodedTxExtraStarknet;
    expect(extraInfo.deployAccountTxId).toBe(CORE_DEPLOY_ACCOUNT_TX_HASH);
  });

  it('derives the hash from the encodedTx, with no broadcast having happened', async () => {
    // a freshly built vault has broadcast nothing, so the value can only come
    // from the encodedTx itself
    const first = await decode(true);
    const second = await decode(true);
    expect((first.extraInfo as IDecodedTxExtraStarknet).deployAccountTxId).toBe(
      (second.extraInfo as IDecodedTxExtraStarknet).deployAccountTxId,
    );
  });

  it('reports the deploy fee in FRI alongside the hash', async () => {
    const extraInfo = (await decode(true)).extraInfo as IDecodedTxExtraStarknet;
    // l2: 0x1c9c380 * 0x5af3107a4000 + l1_data: 0x400 * 0x2540be400
    const expected =
      BigInt('0x1c9c380') * BigInt('0x5af3107a4000') +
      BigInt('0x400') * BigInt('0x2540be400');
    expect(extraInfo.deployAccountFee).toBe(expected.toString(10));
  });

  it('carries no extra info when the account is already deployed', async () => {
    const decodedTx = await decode(false);
    expect(decodedTx.extraInfo).toBeNull();
  });

  it('counts both legs in totalFeeInNative', async () => {
    const withDeploy = await decode(true);
    const withoutDeploy = await decode(false);
    expect(Number(withDeploy.totalFeeInNative)).toBeCloseTo(
      Number(withoutDeploy.totalFeeInNative) * 2,
      12,
    );
  });
});

describe('Starknet private transaction public spending', () => {
  it.each([
    ['register', STRK, '0', '4.5'],
    ['transfer', STRK, '100000000000000000000', '4.5'],
    ['withdraw', STRK, '100000000000000000000', '4.5'],
    ['deposit', STRK, '100000000000000000000', '104.5'],
    ['deposit', '0x123', '100000000000000000000', '4.5'],
  ] as const)(
    'checks only public STRK spent by %s',
    async (kind, tokenAddress, amount, expected) => {
      const encodedTx = buildEncodedTx(false);
      encodedTx.privacy = {
        kind,
        tokenAddress,
        amount,
        poolAddress: '0x456',
        protocolFee: '4500000000000000000',
        proof: '0x01',
        proofFacts: [],
        provingBlockId: 991,
        builtAt: Date.now(),
      };
      const result = await buildVault().buildDecodedTx({
        unsignedTx: { encodedTx },
      });
      expect(result.nativeAmount).toBe(expected);
    },
  );

  it('uses the account as the default public withdrawal recipient', async () => {
    const vault = buildVault();
    const buildAction = jest.fn(async () => ({ type: 'ASSET_TRANSFER' }));
    Object.assign(vault, { buildTxTransferAssetAction: buildAction });
    const encodedTx = buildEncodedTx(false);
    encodedTx.privacy = {
      kind: 'withdraw',
      tokenAddress: STRK,
      amount: '1000000000000000000',
      poolAddress: '0x456',
      protocolFee: '4500000000000000000',
      proof: '0x01',
      proofFacts: [],
      provingBlockId: 991,
      builtAt: Date.now(),
    };
    await vault.buildDecodedTx({ unsignedTx: { encodedTx } });
    expect(buildAction).toHaveBeenCalledWith(
      expect.objectContaining({
        from: sdkStarknet.normalizeAddress('0x456'),
        to: ACCOUNT_ADDRESS,
      }),
    );
  });
});

/**
 * Guards the signing recipe liveRpc.probe.test.ts uses for its opt-in real
 * broadcast. That harness cannot run in CI, so this proves the payload shape
 * still produces core's locked hashes, and that the hash buildDecodedTx
 * recomputes is the one the signer actually emits.
 */
describe('imported signing recipe used by the broadcast harness', () => {
  it('produces the hashes core locked into its own test', async () => {
    const encodedTx = buildEncodedTx(true);
    const signedTx = await new CoreChainImported().signTransaction({
      networkInfo: {
        networkChainCode: 'starknet',
        chainId: NETWORK.chainId,
        networkId: NETWORK.id,
        networkImpl: 'starknet',
        isTestnet: true,
      },
      password: FIXTURE_PASSWORD,
      credentials: {
        imported: await encryptImportedCredential({
          password: FIXTURE_PASSWORD,
          credential: { privateKey: FIXTURE_STARK_PRIVATE_KEY },
        }),
      },
      account: {
        address: ACCOUNT_ADDRESS,
        path: '',
        pub: PUBLIC_KEY,
        pubKey: PUBLIC_KEY,
      },
      unsignedTx: { encodedTx },
    });

    const rawTx = JSON.parse(signedTx.rawTx) as {
      invokeTxHash: string;
      deployAccountTxHash?: string;
    };
    expect(signedTx.txid).toBe(CORE_INVOKE_TX_HASH);
    expect(rawTx.deployAccountTxHash).toBe(CORE_DEPLOY_ACCOUNT_TX_HASH);

    // the value buildDecodedTx recomputes is the one the signer emits
    const decodedTx = await decode(true);
    expect(
      (decodedTx.extraInfo as IDecodedTxExtraStarknet).deployAccountTxId,
    ).toBe(rawTx.deployAccountTxHash);
  });
});
